import { getSearchSynthesisPrompt } from '@/app/lib/prompts/search-synthesis-prompt';
import { performFullSearch, logSearchPerformance } from '@/app/lib/search/query-processor';
import { formatSearchResultsForLLM, formatResultForClient } from '@/app/lib/search/stream-processor';
import { StreamingStatus } from '@/app/lib/search/streaming-types';
import { streamingSearchSchema, type StreamingSearchRequest } from '@/app/lib/validators/schemas';
import { validateRequestBody } from '@/app/lib/validators/validate-request';
import { logSearchError } from '@/app/lib/utils/error-logger';
import { supabaseAdmin } from '@/app/lib/supabase/client-server';

/**
 * Configure this route to use Edge Runtime for optimal performance
 */
export const runtime = 'edge';
export const preferredRegion = 'auto';
export const fetchCache = 'force-no-store'; // Add force-no-store to prevent caching

// Helper to create a response with correct streaming headers
function createStreamResponse(readable: ReadableStream) {
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Prevent Nginx buffering
      'Transfer-Encoding': 'chunked' // Ensure chunked transfer encoding
    },
  });
}

/**
 * Streaming search endpoint - full implementation
 * Handles streaming search with LLM processing for narrative responses
 */
export async function POST(req: Request) {
  // Create encoder/decoder once
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Track query for error logging
  let queryText = 'unknown';
  const startTime = Date.now();
  let searchResultCount = 0;
  let searchIntent = 'general';
  
  try {
    // Parse and validate the request body
    const body = await req.json().catch(() => ({}));
    const validation = await validateRequestBody(body, streamingSearchSchema);
    
    if (!validation.success) {
      console.log('Validation error, logging to error system...');
      await logSearchPerformance({
        query: body?.query || 'validation_error',
        intent: 'error',
        vectorWeight: 0.7,
        textWeight: 0.3,
        efSearch: 300,
        durationMs: Date.now() - startTime,
        resultCount: 0,
        timedOut: false,
        errorMessage: validation.error || 'Invalid request body',
        source: 'streaming-search-validation'
      });
      
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Use validated data
    const {
      query,
      defaultLocation,
      maxResults,
      skipCache,
      promptVersion,
      vectorWeight,
      textWeight,
      efSearch
    } = validation.data;
    
    // Store query for logging
    queryText = query;
    
    // Artificial error for testing - will trigger when search query contains "FORCE_ERROR"
    if (query.includes('FORCE_ERROR')) {
      console.log('Detected test query with FORCE_ERROR - triggering artificial error for testing');
      await logSearchPerformance({
        query,
        intent: 'test',
        vectorWeight: vectorWeight || 0.7,
        textWeight: textWeight || 0.3,
        efSearch: efSearch || 300,
        durationMs: Date.now() - startTime,
        resultCount: 0,
        timedOut: false,
        errorMessage: 'Forced test error from search query containing FORCE_ERROR',
        source: 'streaming-search-test'
      });
      
      return new Response(
        JSON.stringify({ error: 'Forced test error (FORCE_ERROR found in query)' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Log the request parameters
    console.log('Search request:', { 
      query, 
      defaultLocation: defaultLocation || 'none', 
      maxResults,
      vectorWeight,
      textWeight
    });
    
    // Create streaming infrastructure
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Safe write helper with debugging
    const writeChunk = async (data: string) => {
      try {
        await writer.write(encoder.encode(data + '\n'));
      } catch (e) {
        console.error('Error writing to stream:', e);
      }
    };
    
    // Start the main processing in a non-blocking way
    (async () => {
      const localStartTime = Date.now();
      let keepaliveInterval: NodeJS.Timeout | null = null;
      
      try {
        // Initial status update
        await writeChunk(JSON.stringify({
          type: 'status',
          status: 'initializing',
          timestamp: Date.now()
        }));
        
        // Start search
        await writeChunk(JSON.stringify({
          type: 'status',
          status: 'searching',
          timestamp: Date.now()
        }));
        
        // Perform the search
        const searchResponse = await performFullSearch({
          query,
          defaultLocation,
          maxResults,
          includeAnalysis: true,
          skipCache,
          vectorWeight,
          textWeight,
          efSearch,
          similarityThreshold: 0.6
        });
        
        // Capture search metadata for logging
        searchResultCount = searchResponse.results.length;
        searchIntent = searchResponse.analysis?.intent || 'general';
        
        const searchTime = Date.now() - localStartTime;
        console.log(`Search completed in ${searchTime}ms, found ${searchResponse.results.length} results`);
        
        // Search complete status
        await writeChunk(JSON.stringify({
          type: 'status',
          status: 'search_complete',
          resultCount: searchResponse.results.length,
          message: `Found ${searchResponse.results.length} results`,
          timestamp: Date.now()
        }));
        
        // Prepare for generation
        const formattedSearchContent = formatSearchResultsForLLM(
          searchResponse.results,
          query
        );
        
        const systemPrompt = getSearchSynthesisPrompt(
          promptVersion as any,
          searchResponse.analysis,
          searchResponse.results.length,
          query
        );
        
        // Send metadata with search results BEFORE changing status to generating
        // This ensures the UI has the results when it reacts to the 'generating' status
        const clientResults = searchResponse.results.map(formatResultForClient);
        await writeChunk('METADATA:' + JSON.stringify({
          searchResults: clientResults,
          query,
          analysis: searchResponse.analysis,
          searchTime,
          totalResults: searchResponse.results.length,
          defaultLocation
        }));
        
        // AFTER sending metadata, change status to generating
        await writeChunk(JSON.stringify({
          type: 'status',
          status: 'generating',
          message: 'Synthesizing insights from results...',
          timestamp: Date.now()
        }));
        
        // Set up Anthropic API call
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          throw new Error('Anthropic API key not configured');
        }
        
        // Verify we're using the correct model and API version
        console.log(`Using Anthropic model: claude-3-5-haiku-20241022`);
        console.log(`Using API version: 2023-06-01`);
        
        const requestBody = {
          model: 'claude-3-5-haiku-20241022',
          system: systemPrompt,
          messages: [
            { role: 'user', content: formattedSearchContent }
          ],
          max_tokens: 4000,
          temperature: 0.2,
          stream: true
        };
        
        // Log request body shape (not the full content for security)
        console.log('Anthropic request:', {
          model: requestBody.model,
          messageCount: requestBody.messages.length,
          systemPromptLength: systemPrompt.length,
          userContentLength: formattedSearchContent.length,
          stream: requestBody.stream
        });
        
        // Send first keepalive and start regular interval
        await writeChunk(': keepalive ping before streaming\n');
        
        // Set up keepalive interval - every 5 seconds
        keepaliveInterval = setInterval(async () => {
          try {
            await writeChunk(': keepalive ping\n');
          } catch (e) {
            console.error('Error sending keepalive:', e);
            if (keepaliveInterval) clearInterval(keepaliveInterval);
          }
        }, 5000);
        
        // Make the API call with retry
        let response: Response | null = null;
        let retryCount = 0;
        const maxRetries = 1;
        
        while (retryCount <= maxRetries) {
          try {
            console.log('Making Anthropic API request, attempt:', retryCount + 1);
            
            // Ensure proper streaming parameters for Anthropic API
            response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Accept': 'text/event-stream',
              },
              body: JSON.stringify(requestBody),
              cache: 'no-store'
            });
            
            console.log('Anthropic API response status:', response.status);
            console.log('Response headers:', Object.fromEntries([...response.headers.entries()]));
            
            if (response.ok) {
              console.log('Successfully connected to Anthropic API');
              break;
            }
            
            // Log error details for debugging
            const errorText = await response.text().catch(() => 'Could not read error response');
            console.error('Anthropic API error:', response.status, errorText);
            
            retryCount++;
            
            if (retryCount <= maxRetries) {
              console.log(`Retrying Anthropic API call ${retryCount}/${maxRetries}...`);
              await new Promise(r => setTimeout(r, 1000));
            }
          } catch (e) {
            console.error('Fetch error:', e);
            retryCount++;
            if (retryCount <= maxRetries) {
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }
        
        if (!response || !response.ok) {
          throw new Error(`Failed to get response from Anthropic: ${response?.status}`);
        }
        
        // Process the streaming response
        if (!response.body) {
          throw new Error('Response body is null');
        }
        
        // Stream processing
        const reader = response.body.getReader();
        let buffer = '';
        let completedStreamingContent = '';
        
        // Add environment detection
        const isDevelopment = process.env.NODE_ENV === 'development';
        console.log(`Environment detected: ${isDevelopment ? 'development' : 'production'}`);
        
        // Manual stream chunking with environment-specific handling
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Anthropic stream ended');
            break;
          }
          
          // Decode this chunk
          const chunk = decoder.decode(value, { stream: true });
          console.log(`Received chunk of ${chunk.length} bytes`);
          buffer += chunk;
          
          let processed = false;
          
          // Environment-specific handling
          if (isDevelopment) {
            // LOCAL DEVELOPMENT ENVIRONMENT: Handle JSON objects
            if (buffer.includes('{') && buffer.includes('}')) {
              try {
                // Find complete JSON objects
                const jsonStartIndex = buffer.indexOf('{');
                const jsonEndIndex = buffer.lastIndexOf('}') + 1;
                
                if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
                  const possibleJson = buffer.substring(jsonStartIndex, jsonEndIndex);
                  
                  try {
                    const data = JSON.parse(possibleJson);
                    console.log('Parsed message type:', data.type);
                    
                    // Handle content events
                    if (data.type === 'content_block_delta' && data.delta?.text) {
                      completedStreamingContent += data.delta.text;
                      await writeChunk(JSON.stringify({
                        type: 'content',
                        content: completedStreamingContent
                      }));
                      processed = true;
                    }
                    // Also handle already completed content
                    else if (data.type === 'content' && typeof data.content === 'string') {
                      completedStreamingContent = data.content;
                      await writeChunk(JSON.stringify({
                        type: 'content',
                        content: completedStreamingContent
                      }));
                      processed = true;
                    }
                    // Pass through status messages
                    else if (data.type === 'status') {
                      await writeChunk(JSON.stringify(data));
                      processed = true;
                    }
                    
                    // Remove the processed part of the buffer
                    if (processed) {
                      buffer = buffer.substring(jsonEndIndex);
                      await writeChunk(': keepalive\n');
                    }
                  } catch (e) {
                    // Not a complete JSON object, continue collecting
                    console.log('Incomplete JSON object in buffer');
                  }
                }
              } catch (e) {
                console.error('Error processing local format:', e);
              }
            }
            
            // Also process any standard data: lines
            if (!processed) {
              let lineEndIndex;
              while ((lineEndIndex = buffer.indexOf('\n')) !== -1) {
                const line = buffer.substring(0, lineEndIndex);
                buffer = buffer.substring(lineEndIndex + 1);
                
                if (line.startsWith('data: ')) {
                  try {
                    const dataContent = line.substring(6);
                    if (dataContent === '[DONE]') continue;
                    
                    const parsedData = JSON.parse(dataContent);
                    if (parsedData.type === 'content_block_delta' && 
                        parsedData.delta?.text) {
                      
                      completedStreamingContent += parsedData.delta.text;
                      await writeChunk(JSON.stringify({
                        type: 'content',
                        content: completedStreamingContent
                      }));
                      processed = true;
                    }
                  } catch (e) {
                    // Skip lines we can't parse
                  }
                }
              }
            }
          } else {
            // PRODUCTION ENVIRONMENT: Process data lines (standard SSE format)
            let lineEndIndex;
            let processedAny = false;
            
            while ((lineEndIndex = buffer.indexOf('\n')) !== -1) {
              const line = buffer.substring(0, lineEndIndex);
              buffer = buffer.substring(lineEndIndex + 1);
              
              // Process data lines
              if (line.startsWith('data: ')) {
                try {
                  const dataContent = line.substring(6);
                  if (dataContent === '[DONE]') continue;
                  
                  const parsedData = JSON.parse(dataContent);
                  
                  // Extract delta content
                  if (parsedData.type === 'content_block_delta' && 
                      parsedData.delta?.text) {
                    
                    completedStreamingContent += parsedData.delta.text;
                    await writeChunk(JSON.stringify({
                      type: 'content',
                      content: completedStreamingContent
                    }));
                    processedAny = true;
                  }
                } catch (e) {
                  console.log('Error parsing data line:', e);
                }
              }
            }
            
            if (processedAny) {
              await writeChunk(': keepalive\n');
              processed = true;
            }
          }
          
          // Prevent buffer overflow
          if (!processed && buffer.length > 10000) {
            console.log('Buffer growing too large, truncating');
            buffer = buffer.substring(buffer.length - 5000);
          }
        }
        
        // Complete status
        await writeChunk(JSON.stringify({
          type: 'status',
          status: 'complete',
          timestamp: Date.now()
        }));
        
        // Final metadata
        const totalTime = Date.now() - localStartTime;
        await writeChunk('METADATA:' + JSON.stringify({
          searchResults: clientResults,
          query,
          analysis: searchResponse.analysis,
          processingTime: totalTime,
          searchTime,
          aiProcessingTime: totalTime - searchTime,
          totalResults: searchResponse.results.length,
          provider: 'anthropic',
          model: 'claude-3-5-haiku-20241022'
        }));
        
        // Log successful search
        await logSearchPerformance({
          query: queryText,
          intent: searchIntent,
          vectorWeight: vectorWeight || 0.7,
          textWeight: textWeight || 0.3,
          efSearch: efSearch || 300,
          durationMs: totalTime,
          resultCount: searchResultCount,
          timedOut: false,
          source: 'streaming-search'
        }).catch(e => console.error('Failed to log successful search:', e));
        
      } catch (error) {
        console.error('Processing error:', error);
        
        // Log the error to our database - ensure this is working
        console.log('Logging search processing error to error system...');
        await logSearchPerformance({
          query: queryText,
          intent: searchIntent,
          vectorWeight: vectorWeight || 0.7,
          textWeight: textWeight || 0.3,
          efSearch: efSearch || 300,
          durationMs: Date.now() - localStartTime,
          resultCount: searchResultCount,
          timedOut: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          source: 'streaming-search-error'
        }).catch(e => {
          // Make sure to handle errors in the error logger itself
          console.error('Failed to log search error:', e);
        });
        
        try {
          // Send error status
          await writeChunk(JSON.stringify({
            type: 'status',
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
            timestamp: Date.now()
          }));
        } catch (e) {
          console.error('Error sending error status:', e);
        }
      } finally {
        // Clean up
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
        }
        
        try {
          await writer.close();
        } catch (e) {
          console.error('Error closing writer:', e);
        }
      }
    })().catch(error => {
      console.error('Unhandled error in stream processing:', error);
      
      // Ensure proper error logging for unhandled errors
      console.log('Logging unhandled error to error system...');
      logSearchPerformance({
        query: queryText,
        intent: 'error',
        vectorWeight: vectorWeight || 0.7,
        textWeight: textWeight || 0.3,
        efSearch: efSearch || 300,
        durationMs: Date.now() - startTime,
        resultCount: 0,
        timedOut: false,
        errorMessage: `Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
        source: 'streaming-search-unhandled'
      }).catch(e => console.error('Failed to log unhandled error:', e));
    });
    
    // Return the stream immediately
    return createStreamResponse(stream.readable);
    
  } catch (error) {
    console.error('Request handler error:', error);
    
    // Make sure request handler errors are being logged
    console.log('Logging request handler error to error system...');
    try {
      await logSearchPerformance({
        query: queryText,
        intent: 'error',
        vectorWeight: 0.7,
        textWeight: 0.3,
        efSearch: 300,
        durationMs: Date.now() - startTime,
        resultCount: 0,
        timedOut: false,
        errorMessage: `Request handler error: ${error instanceof Error ? error.message : String(error)}`,
        source: 'streaming-search-request-handler'
      });
    } catch (loggingError) {
      console.error('Failed to log request handler error:', loggingError);
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Diagnostic endpoint to check what payload is being sent to Anthropic
 * This is for debugging purposes only
 */
export async function GET(req: Request) {
  try {
    // Get the query from URL params
    const url = new URL(req.url);
    const query = url.searchParams.get('query') || 'test query';
    
    // Execute search
    const searchResponse = await performFullSearch({
      query,
      maxResults: 5,
      includeAnalysis: true,
      skipCache: true,
      vectorWeight: 0.7,
      textWeight: 0.3,
      efSearch: 300,
      similarityThreshold: 0.6
    });
    
    // Format search results for LLM
    const formattedSearchContent = formatSearchResultsForLLM(
      searchResponse.results,
      query
    );
    
    // Get system prompt with enhanced parameters
    const systemPrompt = getSearchSynthesisPrompt(
      'localguru_v0',
      searchResponse.analysis,
      searchResponse.results.length,
      query
    );
    
    // Create sample request body
    const requestBody = {
      model: 'claude-3-5-haiku-20241022',
      system: systemPrompt,
      messages: [
        { role: 'user', content: formattedSearchContent }
      ],
      max_tokens: 4000,
      temperature: 0.7,
      stream: true
    };
    
    // Return the payload that would be sent to Anthropic
    return new Response(JSON.stringify({
      requestBody,
      searchResultsCount: searchResponse.results.length,
      formattedContentSample: formattedSearchContent.substring(0, 1000) + '...',
      fullContent: formattedSearchContent
    }, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Diagnostic endpoint error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
} 