import { getSearchSynthesisPrompt } from '@/app/lib/prompts/search-synthesis-prompt';
import { performFullSearch, logSearchPerformance } from '@/app/lib/search/query-processor';
import { formatSearchResultsForLLM, formatResultForClient } from '@/app/lib/search/stream-processor';
import { StreamingStatus } from '@/app/lib/search/streaming-types';
import { streamingSearchSchema, type StreamingSearchRequest } from '@/app/lib/validators/schemas';
import { validateRequestBody } from '@/app/lib/validators/validate-request';

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
  
  try {
    // Parse and validate the request body
    const body = await req.json().catch(() => ({}));
    const validation = await validateRequestBody(body, streamingSearchSchema);
    
    if (!validation.success) {
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
      const startTime = Date.now();
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
        
        const searchTime = Date.now() - startTime;
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
        
        // Starting generation
        await writeChunk(JSON.stringify({
          type: 'status',
          status: 'generating',
          message: 'Synthesizing insights from results...',
          timestamp: Date.now()
        }));
        
        // Send early metadata with search results
        const clientResults = searchResponse.results.map(formatResultForClient);
        await writeChunk('METADATA:' + JSON.stringify({
          searchResults: clientResults,
          query,
          analysis: searchResponse.analysis,
          searchTime,
          totalResults: searchResponse.results.length,
          defaultLocation
        }));
        
        // Set up Anthropic API call
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          throw new Error('Anthropic API key not configured');
        }
        
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
            response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify(requestBody),
              // Crucial for streaming to work in edge runtime
              cache: 'no-store'
            });
            
            if (response && response.ok) break;
            retryCount++;
            
            if (retryCount <= maxRetries) {
              console.log(`Anthropic API error (${response?.status}), retry ${retryCount}/${maxRetries}`);
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
        
        // Manual stream chunking
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Anthropic stream ended');
            break;
          }
          
          // Decode this chunk
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // Process complete lines
          let lineEndIndex;
          while ((lineEndIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.substring(0, lineEndIndex);
            buffer = buffer.substring(lineEndIndex + 1);
            
            if (line.startsWith('data: ')) {
              const dataContent = line.substring(6);
              
              // Handle completion
              if (dataContent === '[DONE]') {
                console.log('Received [DONE] from Anthropic');
                continue;
              }
              
              try {
                const parsedData = JSON.parse(dataContent);
                
                // Extract the actual content delta
                if (parsedData.type === 'content_block_delta' && 
                    parsedData.delta?.type === 'text_delta' && 
                    parsedData.delta?.text) {
                  
                  const newContent = parsedData.delta.text;
                  completedStreamingContent += newContent;
                  
                  // Send just the delta text as a content update
                  await writeChunk(JSON.stringify({
                    type: 'content',
                    content: completedStreamingContent
                  }));
                  
                  // Send a keepalive after content
                  await writeChunk(': keepalive during streaming\n');
                }
              } catch (parseError) {
                console.error('Error parsing stream data:', parseError);
              }
            }
          }
        }
        
        // Complete status
        await writeChunk(JSON.stringify({
          type: 'status',
          status: 'complete',
          timestamp: Date.now()
        }));
        
        // Final metadata
        const totalTime = Date.now() - startTime;
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
        
      } catch (error) {
        console.error('Processing error:', error);
        
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
    });
    
    // Return the stream immediately
    return createStreamResponse(stream.readable);
    
  } catch (error) {
    console.error('Request handler error:', error);
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