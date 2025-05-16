import { SearchResult } from '../types/search';

export class PerplexitySearchClient {
  private apiKey: string;
  private abortController: AbortController | null = null;

  constructor(apiKey?: string) {
    // Try to get the API key from props first, then environment variables
    const keyFromEnv = process.env.NEXT_PUBLIC_PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY;
    this.apiKey = apiKey || keyFromEnv || '';
    
    if (!this.apiKey) {
      console.warn('No Perplexity API key provided. Using demo mode.');
    } else {
      console.log('Perplexity search client initialized with API key');
    }
  }

  /**
   * Search using Perplexity API with streaming response
   */
  async searchWithPost(query: string, options: any = {}, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    try {
      // Extract location from options
      const location = options.location || 'San Francisco';
      
      console.log(`Making search request to Perplexity API for: "${query}" in ${location}`);
      
      // Create system prompt with location context
      const systemPrompt = `You are LocalGuru, an expert on ${location}. 
        Provide detailed local recommendations with specific business names and addresses. 
        When mentioning a business or location, always include its name, address, and a brief description. 
        Format locations clearly using this syntax: [LOCATION: Business Name, Address, Description]
        Be conversational but concise. Focus on authentic local knowledge.`;
      
      // Prepare request for Perplexity API
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-small-128k-online",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: query
            }
          ],
          temperature: 0.2,
          top_p: 0.9,
          return_citations: true,
          search_recency_filter: "month",
          stream: true
        }),
        signal
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Perplexity search request failed:', response.status, errorText);
        throw new Error(`Perplexity search failed: ${response.status} ${errorText}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // Transform Perplexity streaming format to match our expected format
      const transformedStream = this.transformStream(response.body, query);
      
      console.log('Received streaming response from Perplexity, processing...');
      return transformedStream;
    } catch (error) {
      console.error('Error in Perplexity search:', error);
      throw error;
    }
  }

  /**
   * Transform Perplexity stream format to match our application's expected format
   */
  private transformStream(inputStream: ReadableStream<Uint8Array>, originalQuery: string): ReadableStream<Uint8Array> {
    const reader = inputStream.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Create a transformed stream that converts Perplexity's format to our expected format
    return new ReadableStream({
      async start(controller) {
        // Send initial status message
        controller.enqueue(encoder.encode(JSON.stringify({
          type: 'status',
          status: 'searching'
        }) + '\n'));
        
        // Keep track of accumulated content and citations
        let accumulatedContent = '';
        let citations: any[] = [];
        let currentDelta = '';
        
        try {
          // First, send a transition to streaming state
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'status',
            status: 'streaming'
          }) + '\n'));
          
          // Process each chunk from Perplexity
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // End of stream, send complete status
              
              // First, create searchResults from citations if any
              if (citations.length > 0) {
                const searchResults = citations.map((citation, index) => ({
                  id: `citation-${index}`,
                  title: citation.title || 'Source',
                  snippet: citation.text || '',
                  url: citation.url || '',
                  source: new URL(citation.url || 'https://example.com').hostname
                }));
                
                // Send search results
                controller.enqueue(encoder.encode(JSON.stringify({
                  type: 'results',
                  data: searchResults
                }) + '\n'));
              }
              
              // Send final content update
              controller.enqueue(encoder.encode(JSON.stringify({
                type: 'content',
                content: accumulatedContent
              }) + '\n'));
              
              // Send completion status
              controller.enqueue(encoder.encode(JSON.stringify({
                type: 'status',
                status: 'complete'
              }) + '\n'));
              
              break;
            }
            
            // Decode the chunk
            const chunk = decoder.decode(value, { stream: true });
            
            // Split chunk into lines and process each line
            const lines = chunk.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              
              // Handle special SSE messages
              if (line.startsWith(':')) continue; // Comment line, skip
              if (line === 'data: [DONE]') {
                console.log('Received [DONE] message from Perplexity');
                continue;
              }
              
              // Handle data lines
              if (line.startsWith('data: ')) {
                const dataContent = line.substring(6); // Remove 'data: ' prefix
                
                try {
                  // Parse the JSON data if possible
                  const data = JSON.parse(dataContent);
                  
                  // Extract and process content delta
                  if (data.choices && data.choices.length > 0 && data.choices[0].delta) {
                    const delta = data.choices[0].delta.content;
                    
                    if (delta !== undefined) {
                      // Add to both the current delta and accumulated content
                      currentDelta += delta;
                      accumulatedContent += delta;
                      
                      // Send content update
                      controller.enqueue(encoder.encode(JSON.stringify({
                        type: 'content',
                        content: accumulatedContent
                      }) + '\n'));
                    }
                  }
                  
                  // Process citations if present
                  if (data.citations && data.citations.length > 0) {
                    citations = data.citations;
                  }
                } catch (parseError) {
                  console.log('Error parsing data JSON:', parseError);
                  // If JSON parsing fails, we'll handle it differently
                  
                  // First, check if it's a partial JSON that starts correctly
                  if (dataContent.startsWith('{') && !dataContent.endsWith('}')) {
                    console.log('Received partial JSON data, will process content directly');
                    
                    // Find the content directly (hacky but works for simple cases)
                    const contentMatch = dataContent.match(/"content"\s*:\s*"([^"]*)$/);
                    if (contentMatch && contentMatch[1]) {
                      const partialContent = contentMatch[1];
                      currentDelta += partialContent;
                      accumulatedContent += partialContent;
                      
                      // Send content update
                      controller.enqueue(encoder.encode(JSON.stringify({
                        type: 'content',
                        content: accumulatedContent
                      }) + '\n'));
                    }
                  }
                }
                
                // After each message, if we've accumulated content, send an update
                if (currentDelta) {
                  currentDelta = '';
                  // We already sent the update above
                }
              }
            }
          }
        } catch (error) {
          console.error('Error reading from Perplexity stream:', error);
          
          // Send error status
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'status',
            status: 'error'
          }) + '\n'));
          
          controller.close();
        } finally {
          reader.releaseLock();
        }
      },
      cancel() {
        reader.cancel();
      }
    });
  }

  stopSearch() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
} 