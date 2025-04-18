import { getSearchSynthesisPrompt } from '@/app/lib/prompts/search-synthesis-prompt';
import { performFullSearch } from '@/app/lib/search/query-processor';
import { formatSearchResultsForLLM, formatResultForClient } from '@/app/lib/search/stream-processor';
import { StreamingStatus } from '@/app/lib/search/streaming-types';

/**
 * Configure this route to use Edge Runtime for optimal performance
 */
export const runtime = 'edge';
export const preferredRegion = 'auto';

/**
 * Streaming search endpoint - full implementation
 * Handles streaming search with LLM processing for narrative responses
 */
export async function POST(req: Request) {
  try {
    // Parse request with new hybrid search parameters
    const { 
      query, 
      maxResults = 20, 
      skipCache = false, 
      promptVersion = 'default',
      vectorWeight = 0.7,     // New parameter for hybrid search
      textWeight = 0.3,       // New parameter for hybrid search
      efSearch = 300          // Increase from 100 to 300
    } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required and must be a string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Create encoder for text streaming
    const encoder = new TextEncoder();
    
    // Create readable stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
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
          
          // Execute search with hybrid search parameters
          const searchResponse = await performFullSearch({
            query,
            maxResults: maxResults,
            includeAnalysis: true,
            skipCache: skipCache,
            vectorWeight: vectorWeight,
            textWeight: textWeight,
            efSearch: 300,
            similarityThreshold: 0.6
          });
          
          // Log search time
          const searchTime = Date.now() - startTime;
          console.log(`Search completed in ${searchTime}ms for query: ${query}`);
          
          // Check if any results used fallback search and log it
          const usedFallback = searchResponse.results.some(r => r.metadata?.search_fallback === true);
          if (usedFallback) {
            console.log(`⚠️ FALLBACK: Query "${query}" used text search fallback (vector search timed out)`);
          } else {
            console.log(`✅ VECTOR: Query "${query}" successfully used vector search`);
          }
          
          // Log result match types for debugging
          const matchTypes = searchResponse.results.map(r => r.match_type).filter((v, i, a) => a.indexOf(v) === i);
          console.log(`Match types in results: ${matchTypes.join(', ')}`);
          
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
          
          // Get system prompt
          const systemPrompt = getSearchSynthesisPrompt(promptVersion as any);
          
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
            totalResults: searchResponse.results.length
          });
          
          // Send early metadata before AI processing starts
          console.log(`Sending early metadata with ${clientResults.length} search results`);
          controller.enqueue(encoder.encode('METADATA:' + earlyMetadataJson + '\n'));
          
          // DIRECT API CALL to Anthropic
          const apiKey = process.env.ANTHROPIC_API_KEY;
          
          if (!apiKey) {
            throw new Error('Anthropic API key not configured');
          }
          
          console.log('Making direct API call to Anthropic...', query);
          console.log('Anthropic API Key (first 4 chars):', apiKey.substring(0, 4));
          
          // Try with the exact Claude API parameters
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
              
              response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
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
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            console.log('Received chunk:', chunk.substring(0, 50) + '...');
            
            const lines = chunk.split('\n').filter(line => line.trim());
            
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
          }
          
          // Send complete status
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'status', 
            status: 'complete' as StreamingStatus,
            timestamp: Date.now()
          }) + '\n'));
          
          // Calculate total time
          const totalTime = Date.now() - startTime;
          console.log(`Total request processed in ${totalTime}ms for query: ${query}`);
          console.log(`Search: ${searchTime}ms, AI: ${totalTime - searchTime}ms`);
          
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
          
          // Log metadata for debugging
          console.log(`Sending metadata with ${clientResults.length} search results`);
          console.log(`First result title: ${clientResults[0]?.title || 'No results'}`);
          
          // Send metadata
          controller.enqueue(encoder.encode('METADATA:' + metadataJson + '\n'));
          
          // Close stream
          controller.close();
        } catch (error) {
          // Send error status
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'status', 
            status: 'error' as StreamingStatus,
            message: error instanceof Error ? error.message : 'An unexpected error occurred',
            timestamp: Date.now()
          }) + '\n'));
          
          // Close stream
          controller.close();
          
          console.error('Error in streaming search:', error);
        }
      }
    });
    
    // Return streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('Error in streaming search:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred during streaming search',
        details: error instanceof Error ? error.message : String(error)
      }),
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
} 