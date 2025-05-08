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
    
    // Create a TransformStream for easier management
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    
    // Function to write and immediately flush data
    const writeAndFlush = async (data: string) => {
      console.log('Writing to stream:', data.substring(0, 50) + (data.length > 50 ? '...' : ''));
      await writer.write(encoder.encode(data));
    };
    
    // Process in a separate async task to avoid blocking the response
    (async () => {
      try {
        // Create an AbortController for Anthropic API calls
        const anthropicController = new AbortController();
        
        // Send initial status
        await writeAndFlush(JSON.stringify({ 
          type: 'status', 
          status: 'initializing' as StreamingStatus,
          timestamp: Date.now()
        }) + '\n');
        
        // Start timing
        const startTime = Date.now();
        
        // Send searching status
        await writeAndFlush(JSON.stringify({ 
          type: 'status', 
          status: 'searching' as StreamingStatus,
          timestamp: Date.now()
        }) + '\n');
        
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
        console.log(`Search results: ${searchResponse.results.length} items found`);
        
        // Send search complete status
        await writeAndFlush(JSON.stringify({ 
          type: 'status', 
          status: 'search_complete' as StreamingStatus,
          resultCount: searchResponse.results.length,
          message: `Found ${searchResponse.results.length} results`,
          timestamp: Date.now()
        }) + '\n');
        
        // Format search results for LLM
        const formattedSearchContent = formatSearchResultsForLLM(
          searchResponse.results,
          query
        );
        
        // Get system prompt
        const systemPrompt = getSearchSynthesisPrompt(
          promptVersion as any,
          searchResponse.analysis,
          searchResponse.results.length,
          query
        );
        
        // Send generating status
        await writeAndFlush(JSON.stringify({ 
          type: 'status', 
          status: 'generating' as StreamingStatus,
          message: 'Synthesizing insights from results...',
          timestamp: Date.now()
        }) + '\n');
        
        // Format client results
        const clientResults = searchResponse.results.map(formatResultForClient);
        
        // Send early metadata
        const earlyMetadataJson = JSON.stringify({
          searchResults: clientResults,
          query,
          analysis: searchResponse.analysis,
          searchTime,
          totalResults: searchResponse.results.length,
          defaultLocation
        });
        
        await writeAndFlush('METADATA:' + earlyMetadataJson + '\n');
        console.log('Metadata sent, preparing for AI streaming...');
        
        // DIRECT API CALL to Anthropic
        const apiKey = process.env.ANTHROPIC_API_KEY;
        
        if (!apiKey) {
          throw new Error('Anthropic API key not configured');
        }
        
        // Try with the exact Claude API parameters
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
        
        console.log('Making API call to Anthropic...');
        
        // Simple retry once if needed
        let response: Response | null = null;
        let retryCount = 0;
        
        while (retryCount < 2) {
          try {
            response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify(requestBody)
            });
            
            if (response.ok) break;
            
            // Just retry once on any error
            retryCount++;
            console.log(`Anthropic API error, retry ${retryCount}/1...`);
            await new Promise(r => setTimeout(r, 1000));
          } catch (e) {
            console.error('Fetch error:', e);
            retryCount++;
          }
        }
        
        if (!response || !response.ok) {
          throw new Error(`Failed to get a response from Anthropic API: ${response?.status} ${response?.statusText}`);
        }
        
        // Process AI Stream - SIMPLIFIED APPROACH
        console.log('Start reading Anthropic stream...');
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        
        // Send a keepalive ping
        await writeAndFlush(': keepalive ping before streaming\n\n');
        
        try {
          // Simplified stream processing
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('Stream reading complete');
              break;
            }
            
            const chunk = decoder.decode(value);
            console.log(`Received chunk: ${chunk.length} bytes`);
            
            // Simple parsing - split by lines
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (!line.trim() || !line.startsWith('data: ')) continue;
              
              try {
                const data = line.substring(6);
                if (data === '[DONE]') continue;
                
                const parsed = JSON.parse(data);
                
                // Handle content delta
                if (parsed.type === 'content_block_delta' && 
                    parsed.delta?.type === 'text_delta' && 
                    parsed.delta?.text) {
                  
                  accumulatedText += parsed.delta.text;
                  
                  // Send immediately to client
                  await writeAndFlush(JSON.stringify({ 
                    type: 'content', 
                    content: accumulatedText
                  }) + '\n');
                  
                  // Also send a keepalive after each chunk
                  await writeAndFlush(': keepalive during streaming\n\n');
                }
              } catch (e) {
                console.error('Error parsing stream data:', e);
              }
            }
          }
        } catch (streamError) {
          console.error('Error processing AI stream:', streamError);
          // Send the accumulated text anyway
          if (accumulatedText) {
            await writeAndFlush(JSON.stringify({ 
              type: 'content', 
              content: accumulatedText + "\n\n[Note: The response was cut short due to a technical issue]"
            }) + '\n');
          }
        }
        
        // Send complete status
        await writeAndFlush(JSON.stringify({ 
          type: 'status', 
          status: 'complete' as StreamingStatus,
          timestamp: Date.now()
        }) + '\n');
        
        // Add final metadata
        const totalTime = Date.now() - startTime;
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
        
        await writeAndFlush('METADATA:' + metadataJson + '\n');
        
      } catch (error) {
        console.error('Processing error:', error);
        
        // Send error to client
        await writeAndFlush(JSON.stringify({ 
          type: 'status', 
          status: 'error' as StreamingStatus,
          message: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        }) + '\n');
      } finally {
        // Always close the writer when done
        try {
          await writer.close();
        } catch (e) {
          console.error('Error closing writer:', e);
        }
      }
    })().catch(e => console.error('Unhandled error in stream processing:', e));
    
    // Return the readable stream immediately
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Error in request handler:', error);
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