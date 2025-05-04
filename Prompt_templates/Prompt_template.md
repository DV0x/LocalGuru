

## Question 1: Detailed TypeScript Implementation

Here's a complete TypeScript implementation using the prompt structure from your example:

```typescript
import { Anthropic } from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key',
});

// Define the interface for search results
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
  // Construct prompt elements
  const TASK_CONTEXT = "You are a helpful local search assistant that provides concise, accurate information about businesses and services in the user's area. Your responses should be conversational but focused on answering the specific question asked.";
  
  const TONE_CONTEXT = "Maintain a friendly, helpful tone. Be concise but thorough, and focus on the most relevant details in your answers.";
  
  const SEARCH_RESULTS = `<json_results>${JSON.stringify(searchResults, null, 2)}</json_results>`;
  
  const INPUT_DATA = `I will provide you with JSON search results and a user query. The JSON contains information from a local search engine.

<user_query>
${userQuery}
</user_query>

${SEARCH_RESULTS}`;
  
  const EXAMPLES = `Here's an example of how to respond to a user query based on JSON search results:

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
  
  const TASK_DESCRIPTION = `Your job is to:
1. Analyze the JSON search results provided
2. Extract the information that directly answers the user's query
3. Present a concise, organized response that addresses all parts of their question
4. Only include information found in the search results
5. If the search results don't contain information needed to fully answer the query, acknowledge this in your response

If multiple sources give different information, synthesize them and note any discrepancies.`;
  
  const IMMEDIATE_TASK = "Based on the search results provided, answer the user's query completely and concisely.";
  
  const PRECOGNITION = `Before answering, analyze the JSON results using these steps:
1. Identify which JSON results contain information relevant to each part of the user's query
2. Extract the key facts and details needed
3. Organize these facts in a logical order for your response
4. Consider what information might be missing that the user would want to know`;
  
  const OUTPUT_FORMATTING = "Format your response in <response></response> tags. Use bullet points where appropriate for clarity.";
  
  const PREFILL = "<response>";

  // Combine all elements
  let PROMPT = "";
  
  if (TASK_CONTEXT) PROMPT += TASK_CONTEXT;
  if (TONE_CONTEXT) PROMPT += `\n\n${TONE_CONTEXT}`;
  if (INPUT_DATA) PROMPT += `\n\n${INPUT_DATA}`;
  if (EXAMPLES) PROMPT += `\n\n${EXAMPLES}`;
  if (TASK_DESCRIPTION) PROMPT += `\n\n${TASK_DESCRIPTION}`;
  if (IMMEDIATE_TASK) PROMPT += `\n\n${IMMEDIATE_TASK}`;
  if (PRECOGNITION) PROMPT += `\n\n${PRECOGNITION}`;
  if (OUTPUT_FORMATTING) PROMPT += `\n\n${OUTPUT_FORMATTING}`;

  // Make API call to Anthropic
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229', // Or your preferred model
      max_tokens: 1000,
      temperature: 0,
      messages: [
        { role: 'user', content: PROMPT },
        { role: 'assistant', content: PREFILL }
      ],
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
}

// Example usage
async function main() {
  const sampleResults: SearchResponse = {
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

  const userQuery = "What are the best coffee shops downtown and when do they close?";
  
  try {
    const answer = await getLocalSearchResponse(sampleResults, userQuery);
    console.log(answer);
  } catch (error) {
    console.error('Error getting search response:', error);
  }
}

main();
```

## Question 2: Do we need to send the entire prompt structure on every API call?

Yes, you do need to send the entire prompt structure with each API call because:

1. **Stateless API**: The Anthropic API is stateless - each request is independent and doesn't retain information from previous calls.

2. **Complete Context**: The entire prompt structure provides the complete context, instructions, examples, and formatting requirements needed for Claude to generate the desired response.

3. **Different Variables**: While the structure stays the same, the dynamic variables (search results and user query) change with each call.

However, you can optimize this by:

1. **Creating a template function**: As shown in the TypeScript example above, build the prompt once per request rather than hard-coding it repeatedly.

2. **Caching prompt components**: Store the static parts of the prompt (examples, task descriptions) and only combine them with dynamic content at request time.

3. **Reducing unnecessary elements**: If you find through testing that certain sections don't improve results, you could remove them to reduce token usage.

4. **Using conversation history**: For follow-up questions about the same search results, you could use the messages array to build on previous responses rather than starting fresh.

This approach gives you the benefits of the structured prompt while making implementation clean and maintainable in your code.
