

# Optimizing Local Search Bot with Anthropic's Prompt Caching

You can significantly reduce token usage and costs by implementing Anthropic's prompt caching feature. Here's how to optimize the TypeScript script with prompt caching:

```typescript
import { Anthropic } from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key',
});

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  url: string;
}

interface SearchResponse {
  results: SearchResult[];
  location: string;
  total_results: number;
}

async function getLocalSearchResponse(searchResults: SearchResponse, userQuery: string): Promise<string> {
  // Create the static parts of the prompt that can be cached
  // These rarely change and are ideal for caching
  const STATIC_SYSTEM_PROMPT = `You are a helpful local search assistant that provides concise, accurate information about businesses and services in the user's area. Your responses should be conversational but focused on answering the specific question asked.

Maintain a friendly, helpful tone. Be concise but thorough, and focus on the most relevant details in your answers.

Your job is to:
1. Analyze the JSON search results provided
2. Extract the information that directly answers the user's query
3. Present a concise, organized response that addresses all parts of their question
4. Only include information found in the search results
5. If the search results don't contain information needed to fully answer the query, acknowledge this in your response

If multiple sources give different information, synthesize them and note any discrepancies.

Here's an example of how to respond to a user query based on JSON search results:

<example>
User Query: "Where can I find Italian restaurants that are open late?"

JSON Results: 
{
  "results": [
    {
      "id": "1",
      "title": "Bella Notte Restaurant",
      "snippet": "Authentic Italian cuisine, open until midnight on Fridays and Saturdays. 4.5★ rating with 230 reviews.",
      "url": "https://example.com/bella-notte"
    },
    {
      "id": "2",
      "title": "Late Night Dining Guide",
      "snippet": "Top late-night options include Bella Notte (Italian, until 12am), Pizza Express (until 2am), and Milano Café (Italian, until 11pm).",
      "url": "https://example.com/late-night"
    }
  ]
}

Response:
<response>
Based on the search results, there are a couple of good Italian restaurants open late in the area:

• Bella Notte Restaurant stays open until midnight on Fridays and Saturdays and has a 4.5-star rating with 230 reviews.
• Milano Café is open until 11pm.

If you're looking for very late options, Pizza Express is open until 2am, though it's not specifically identified as Italian in the results.
</response>
</example>`;

  // Make API call to Anthropic with caching
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229', // Choose a model that supports caching
      max_tokens: 1000,
      temperature: 0,
      system: STATIC_SYSTEM_PROMPT,
      messages: [
        { 
          role: 'user', 
          content: [
            {
              type: 'text',
              text: `I will provide you with JSON search results and a user query. The JSON contains information from a local search engine.

<user_query>
${userQuery}
</user_query>

<json_results>${JSON.stringify(searchResults, null, 2)}</json_results>

Before answering, analyze the JSON results using these steps:
1. Identify which JSON results contain information relevant to each part of the user's query
2. Extract the key facts and details needed
3. Organize these facts in a logical order for your response
4. Consider what information might be missing that the user would want to know

Based on the search results provided, answer the user's query completely and concisely.

Format your response in <response></response> tags. Use bullet points where appropriate for clarity.`
            }
          ],
          cache_control: {
            ttl: "ephemeral"  // Set the cache to have the minimum 5-minute lifetime
          }
        }
      ]
    });

    // Log cache usage statistics to monitor effectiveness
    console.log(`Cache stats: created=${response.usage?.cache_creation_input_tokens || 0}, read=${response.usage?.cache_read_input_tokens || 0}, input=${response.usage?.input_tokens || 0}`);

    return response.content[0].text;
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
}

// Example implementation of a search handler function
async function handleSearch(query: string): Promise<string> {
  // In a real implementation, you would fetch actual search results
  // This is just a mock for example purposes
  const mockResults: SearchResponse = {
    results: [
      {
        id: "1",
        title: "Best Coffee Shops in Downtown",
        snippet: "Top-rated cafes include Brew Palace (4.8★), Morning Grind (4.7★), and Urban Bean (4.6★). All offer free WiFi and outdoor seating.",
        url: "https://example.com/coffee-downtown"
      },
      {
        id: "2",
        title: "Coffee Shop Working Hours Guide",
        snippet: "Downtown coffee shops typically open 6:30am-8pm weekdays, with Brew Palace open until 10pm Thursday-Saturday. Morning Grind opens at 5:30am for early risers.",
        url: "https://example.com/coffee-hours"
      }
    ],
    location: "Downtown Metro Area",
    total_results: 24
  };
  
  return await getLocalSearchResponse(mockResults, query);
}

// Service implementation for a search API endpoint
export class SearchService {
  async search(query: string): Promise<string> {
    return handleSearch(query);
  }
}
```

## Key Optimizations Applied

1. **System Message Caching**: The static system prompt now contains all the instructions, examples, and formatting guidelines that don't change between requests. By placing this in the `system` parameter, it becomes part of the cacheable prefix.

2. **User Message Caching**: The `cache_control` parameter on the user message allows for caching the structured prompt format, even though the actual search results and query are different each time.

3. **Cache Usage Monitoring**: Added logging of cache metrics to track effectiveness.

4. **Service Structure**: Wrapped everything in a service class to make it more scalable for API implementations.

## Benefits of This Approach

1. **90% Cost Reduction on Cached Content**: After the first call, subsequent calls only pay 10% of the normal input token price for the cached portions.

2. **Reduced Latency**: Cached prompts process much faster since Claude doesn't need to reprocess the instructions and examples.

3. **Scalability**: This design works well for high-volume search operations where the same type of query is processed repeatedly with different search results.

4. **Maintainability**: Clean separation between static and dynamic content makes the code easier to update.

## Additional Scaling Recommendations

For even greater efficiency in production:

1. **Multiple Cache Breakpoints**: If your prompt is very large, consider using multiple cache breakpoints to enable partial cache hits.

2. **Prewarming Cache**: Schedule regular "keep-alive" requests to prevent cache expiration for frequently used prompts.

3. **Monitoring Cache Performance**: Track the cache hit rate over time and adjust your caching strategy based on usage patterns.

4. **Load Balancing**: For high-volume applications, implement a queue system that routes similar requests through the same instance to maximize cache reuse.

This implementation provides a smart, scalable solution that should significantly reduce your input token usage while maintaining the full quality of responses.
