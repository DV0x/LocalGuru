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
    // Parse request
    const { query, maxResults = 10, skipCache = false, promptVersion = 'default' } = await req.json();
    
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
          
          // Execute search
          const searchResponse = await performFullSearch({
            query,
            maxResults: maxResults,
            includeAnalysis: true,
            skipCache: skipCache
          });
          
          // Log search time
          const searchTime = Date.now() - startTime;
          console.log(`Search completed in ${searchTime}ms for query: ${query}`);
          
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
          
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody)
          });
          
          if (!response.ok) {
            // Log detailed error info but don't provide a fallback
            const errorText = await response.text().catch(() => 'Unable to get error details');
            console.error(`Anthropic API error: ${response.status} ${response.statusText}`);
            console.error(`Error details: ${errorText}`);
            console.error('Request headers:', {
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01',
              'x-api-key': 'present but not shown'
            });
            
            // Just pass the error through to the client
            throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`);
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
            
            const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));
            
            for (const line of lines) {
              const data = line.substring(6); // Remove 'data: ' prefix
              if (data === '[DONE]') continue;
              
              try {
                const parsed = JSON.parse(data);
                console.log('Parsed data type:', parsed.type);
                
                // Handle different Anthropic streaming response formats
                if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.text) {
                  accumulatedText += parsed.delta.text;
                  console.log('Added content delta, new length:', accumulatedText.length);
                } else if (parsed.type === 'content_block_start' && parsed.content_block && parsed.content_block.text) {
                  accumulatedText += parsed.content_block.text;
                  console.log('Added content block, new length:', accumulatedText.length);
                } else if (parsed.type === 'content_block_delta' && parsed.delta && parsed.delta.type === 'text_delta') {
                  accumulatedText += parsed.delta.text;
                  console.log('Added text delta, new length:', accumulatedText.length);
                } else if (parsed.completion) {
                  // Legacy format
                  accumulatedText += parsed.completion;
                  console.log('Added completion, new length:', accumulatedText.length);
                }
                
                // Send content update with whatever text we've accumulated
                controller.enqueue(encoder.encode(JSON.stringify({ 
                  type: 'content', 
                  content: accumulatedText
                }) + '\n'));
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