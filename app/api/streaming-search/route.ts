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

/**
 * Streaming search endpoint - full implementation
 * Handles streaming search with LLM processing for narrative responses
 */
export async function POST(req: Request) {
  try {
    // Parse the request body
    const body = await req.json().catch(() => ({}));
    
    // Validate the request body using Zod
    const validation = await validateRequestBody(body, streamingSearchSchema);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Use the validated data with proper types
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
    
    // Create encoder for text streaming
    const encoder = new TextEncoder();
    
    // Create readable stream
    const stream = new ReadableStream({
      async start(controller) {
        // Flag to track if the request has been aborted
        let isAborted = false;
        
        // Create an AbortController for Anthropic API calls
        const anthropicController = new AbortController();
        
        // Setup heartbeat/keepalive to prevent connection timeouts
        const keepAliveInterval = setInterval(() => {
          if (!isAborted) {
            try {
              controller.enqueue(encoder.encode(': keepalive\n\n')); // SSE comment for keepalive
              console.log('Sent keepalive ping');
            } catch (e) {
              console.error('Error sending keepalive:', e);
              clearInterval(keepAliveInterval);
            }
          } else {
            clearInterval(keepAliveInterval);
          }
        }, 15000); // Send keepalive every 15 seconds
        
        try {
          // Setup abort handler for client disconnection
          const abortListener = () => {
            console.log('Client aborted the request, cleaning up resources');
            isAborted = true;
            // Abort any ongoing Anthropic API requests
            anthropicController.abort();
            // Close the stream gracefully
            controller.close();
          };
          
          // Listen for abort event
          req.signal.addEventListener('abort', abortListener);
          
          // Send initial status
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'status', 
            status: 'initializing' as StreamingStatus,
            timestamp: Date.now()
          }) + '\n'));
          
          // Start timing
          const startTime = Date.now();
          
          // Send searching status
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'status', 
            status: 'searching' as StreamingStatus,
            timestamp: Date.now()
          }) + '\n'));
          
          // Execute search with validated parameters
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
          
          // Log search time
          const searchTime = Date.now() - startTime;
          console.log(`Search completed in ${searchTime}ms for query: ${query}`);
          
          // Replace detailed logging with a summary
          console.log(`Search results: ${searchResponse.results.length} items found`);
          console.log(`Locations: ${searchResponse.analysis?.locations?.join(', ') || 'none'}`);
          
          // Check if any results used fallback search and log it
          const usedFallback = searchResponse.results.some(r => r.metadata?.search_fallback === true);
          if (usedFallback) {
            console.log(`⚠️ FALLBACK: Query "${query}" used text search fallback (vector search timed out)`);
          }
          
          // Log match types for debugging (more concise)
          const matchTypes = searchResponse.results.map(r => r.match_type).filter((v, i, a) => a.indexOf(v) === i);
          console.log(`Match types: ${matchTypes.join(', ')}`);
          
          // Log search performance data
          await logSearchPerformance({
            query,
            intent: searchResponse.analysis?.intent || 'unknown',
            vectorWeight: vectorWeight || 0.7,
            textWeight: textWeight || 0.3,
            efSearch: efSearch || 300,
            durationMs: searchTime,
            resultCount: searchResponse.results.length,
            timedOut: usedFallback,
            source: 'streaming-search'
          });
          
          // Send search complete status
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'status', 
            status: 'search_complete' as StreamingStatus,
            resultCount: searchResponse.results.length,
            message: `Found ${searchResponse.results.length} results`,
            timestamp: Date.now()
          }) + '\n'));
          
          // Format search results for LLM
          const formattedSearchContent = formatSearchResultsForLLM(
            searchResponse.results,
            query
          );
          
          // Log a single line for formatted content instead of the content itself
          console.log('Formatted content for Anthropic (length):', formattedSearchContent.length);
          
          // Get system prompt with enhanced parameters
          const systemPrompt = getSearchSynthesisPrompt(
            promptVersion as any,
            searchResponse.analysis, // Still pass analysis for other prompt types
            searchResponse.results.length, // Pass total results count
            query // Pass the original user query
          );
          
          // Send generating status
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'status', 
            status: 'generating' as StreamingStatus,
            message: 'Synthesizing insights from results...',
            timestamp: Date.now()
          }) + '\n'));
          
          // Format client results
          const clientResults = searchResponse.results.map(formatResultForClient);
          
          // Send metadata early so client has search results while content is streaming
          const earlyMetadataJson = JSON.stringify({
            searchResults: clientResults,
            query,
            analysis: searchResponse.analysis,
            searchTime,
            totalResults: searchResponse.results.length,
            defaultLocation // Include the defaultLocation in metadata
          });
          
          // Send early metadata before AI processing starts
          console.log(`Sending metadata with ${clientResults.length} search results`);
          controller.enqueue(encoder.encode('METADATA:' + earlyMetadataJson + '\n'));
          
          // DIRECT API CALL to Anthropic
          const apiKey = process.env.ANTHROPIC_API_KEY;
          
          if (!apiKey) {
            throw new Error('Anthropic API key not configured');
          }
          
          console.log('Making API call to Anthropic for query:', query);
          console.log('Anthropic API Key (first 4 chars):', apiKey.substring(0, 4));
          
          // Use the enhanced system prompt directly without additional instructions
          const oneStepSystemPrompt = systemPrompt;
          
          // Try with the exact Claude API parameters
          const requestBody = {
            model: 'claude-3-5-haiku-20241022',
            system: oneStepSystemPrompt,
            messages: [
              { role: 'user', content: formattedSearchContent }
            ],
            max_tokens: 4000,
            temperature: 0.2, // Low temperature for more comprehensive coverage as recommended
            stream: true
          };
          
          console.log('Request body structure:', Object.keys(requestBody));
          console.log('Model:', requestBody.model);
          
          // Retry logic for handling overloaded_error
          const MAX_RETRIES = 3;
          const INITIAL_RETRY_DELAY = 1000;
          
          // Helper function for delay
          const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
          
          let retryCount = 0;
          let response: Response | null = null;
          
          while (retryCount <= MAX_RETRIES) {
            try {
              if (retryCount > 0) {
                // Calculate exponential backoff with jitter
                const backoffDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1);
                const jitter = Math.random() * 0.3 * backoffDelay; // 0-30% jitter
                const totalDelay = backoffDelay + jitter;
                
                console.log(`Anthropic API retry ${retryCount}/${MAX_RETRIES} after ${Math.round(totalDelay)}ms delay...`);
                
                // Send retry status to client
                controller.enqueue(encoder.encode(JSON.stringify({ 
                  type: 'status', 
                  status: 'retrying' as StreamingStatus,
                  message: `Service temporarily overloaded. Retry ${retryCount}/${MAX_RETRIES}...`,
                  timestamp: Date.now()
                }) + '\n'));
                
                await sleep(totalDelay);
              }
              
              // Check if the request has been aborted before making the API call
              if (isAborted) {
                console.log('Request was aborted, skipping Anthropic API call');
                break;
              }
              
              response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01',
                  'Connection': 'keep-alive' // Explicitly keep connection alive
                },
                body: JSON.stringify(requestBody),
                signal: anthropicController.signal, // Add abort signal
                cache: 'no-store', // Bypass cache
                keepalive: true // Keep connection alive
              });
              
              // If we got a success response, break out of the retry loop
              if (response.ok) {
                break;
              }
              
              // Handle non-overloaded errors immediately without retry
              const errorText = await response.text().catch(() => 'Unable to get error details');
              if (!errorText.includes('overloaded_error')) {
                console.error(`Anthropic API error: ${response.status} ${response.statusText}`);
                console.error(`Error details: ${errorText}`);
                throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`);
              }
              
              // It was an overloaded error, so we'll retry
              console.error(`Anthropic API overloaded. Will retry (${retryCount + 1}/${MAX_RETRIES})`);
              retryCount++;
              
              // If we've used all our retries, throw the last error
              if (retryCount > MAX_RETRIES) {
                throw new Error(`Anthropic API overloaded after ${MAX_RETRIES} retries. Please try again later.`);
              }
            } catch (error) {
              // If it's not a response error (e.g., network error), throw immediately
              if (!response) {
                throw error;
              }
              
              // Otherwise, continue with the retry loop
              retryCount++;
              
              // If we've used all our retries, throw the last error
              if (retryCount > MAX_RETRIES) {
                throw error;
              }
            }
          }
          
          if (!response || !response.ok) {
            // This should never happen if the loop worked properly, but just in case
            throw new Error(`Failed to get a successful response from Anthropic API after ${retryCount} retries`);
          }
          
          // Process the streaming response from Anthropic
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let accumulatedText = '';
          
          console.log('Starting to process Anthropic stream...');
          
          // Send a keepalive immediately before starting stream processing
          controller.enqueue(encoder.encode(': starting stream\n\n'));
          
          while (true) {
            // Check if the request has been aborted
            if (isAborted) {
              console.log('Request was aborted, stopping stream processing');
              break;
            }
            
            try {
              console.log('Reading from Anthropic stream...');
              const { done, value } = await reader.read();
              
              if (done) {
                console.log('Anthropic stream complete');
                break;
              }
              
              const chunk = decoder.decode(value);
              // Truncate chunk logging
              console.log('Received chunk of', chunk.length, 'bytes');
              
              const lines = chunk.split('\n').filter(line => line.trim());
              
              // Process each line
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                
                const data = line.substring(6); // Remove 'data: ' prefix
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  console.log('Parsed event type:', parsed.type);
                  
                  // Handle error events from Anthropic
                  if (parsed.type === 'error') {
                    const errorDetails = parsed.error || {};
                    console.error('Anthropic streaming error:', JSON.stringify(errorDetails));
                    
                    // Return a meaningful error to the client
                    controller.enqueue(encoder.encode(JSON.stringify({ 
                      type: 'status', 
                      status: 'error' as StreamingStatus,
                      message: `Anthropic API error: ${errorDetails.type || 'unknown'} - ${errorDetails.message || 'No details provided'}`,
                      timestamp: Date.now()
                    }) + '\n'));
                    
                    // If overloaded and no search results, provide a fallback content message
                    if (errorDetails.type === 'overloaded_error' && clientResults.length === 0) {
                      controller.enqueue(encoder.encode(JSON.stringify({ 
                        type: 'content', 
                        content: "I apologize, but I couldn't find specific information about this query in our database, and our AI service is currently experiencing high demand. Please try a different query or try again in a few moments."
                      }) + '\n'));
                    }
                    
                    // Don't break the loop here - we might get additional events
                  }
                  // Handle Anthropic streaming response (Claude 3 Messages API format)
                  else if (parsed.type === 'content_block_delta' && 
                      parsed.delta && 
                      parsed.delta.type === 'text_delta' && 
                      parsed.delta.text) {
                    // This is the main text content from Claude
                    accumulatedText += parsed.delta.text;
                    
                    // Send content update with current accumulated text
                    controller.enqueue(encoder.encode(JSON.stringify({ 
                      type: 'content', 
                      content: accumulatedText
                    }) + '\n'));
                    
                    console.log('Added text delta, new length:', accumulatedText.length);
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e, 'Raw data:', data);
                }
              }
            } catch (error) {
              console.error('Error reading from stream:', error);
              // Break the loop if there's an error reading from the stream
              break;
            }
          }
          
          // Send complete status
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'status', 
            status: 'complete' as StreamingStatus,
            timestamp: Date.now()
          }) + '\n'));
          
          // Calculate total time
          const totalTime = Date.now() - startTime;
          console.log(`Request processed in ${totalTime}ms (Search: ${searchTime}ms, AI: ${totalTime - searchTime}ms)`);
          
          // Add metadata
          const metadataJson = JSON.stringify({
            searchResults: clientResults,
            query,
            analysis: searchResponse.analysis,
            processingTime: totalTime,
            searchTime,
            aiProcessingTime: totalTime - searchTime,
            totalResults: searchResponse.results.length,
            provider: 'anthropic',
            model: 'claude-3-5-haiku-20241022'
          });
          
          // Log metadata summary instead of details
          console.log(`Sending final metadata with ${clientResults.length} results`);
          
          // Send metadata
          controller.enqueue(encoder.encode('METADATA:' + metadataJson + '\n'));
          
          // Close stream
          controller.close();
        } catch (error) {
          console.error('Error processing streaming search:', error);
          
          // Log the search error
          await logSearchPerformance({
            query,
            intent: 'error', // Placeholder since we don't have analysis
            vectorWeight: vectorWeight || 0.7,
            textWeight: textWeight || 0.3,
            efSearch: efSearch || 300,
            durationMs: Date.now() - (req.headers.get('x-request-start') ? 
              parseInt(req.headers.get('x-request-start') || '0', 10) : Date.now()),
            resultCount: 0,
            timedOut: false,
            errorMessage: error instanceof Error ? error.message : String(error),
            source: 'streaming-search-error'
          });
          
          // Send error status to client
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'status', 
            status: 'error' as StreamingStatus,
            message: 'An error occurred during search',
            timestamp: Date.now()
          }) + '\n'));
          
          // Close the stream
          controller.close();
        } finally {
          // Clean up heartbeat interval
          clearInterval(keepAliveInterval);
        }
      }
    });
    
    // Return the stream response with enhanced headers for Edge
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Prevents Nginx buffering
        'Transfer-Encoding': 'chunked' // Explicitly enable chunked transfer
      },
    });
  } catch (error) {
    console.error('Error handling streaming search request:', error);
    
    // Log errors that happen outside the stream processing
    try {
      await logSearchPerformance({
        query: typeof error === 'object' && error !== null && 'requestBody' in error 
          ? JSON.parse(String(error.requestBody) || '{}').query || 'unknown'
          : 'unknown',
        intent: 'error',
        vectorWeight: 0.7,
        textWeight: 0.3,
        efSearch: 300,
        durationMs: 0,
        resultCount: 0,
        timedOut: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        source: 'streaming-search-fatal'
      });
    } catch (logError) {
      console.error('Failed to log search error:', logError);
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