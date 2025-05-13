
## Current System Prompts and LLM Configuration

### 1. System Prompt Types

LocalGuru uses several prompt versions defined in `app/lib/prompts/search-synthesis-prompt.ts`:

- **Default**: A conversational prompt that balances thoroughness with conciseness
- **Concise**: A brief, direct prompt for shorter responses (under 200 words)
- **Detailed**: A comprehensive prompt for thorough, structured answers
- **Travel**: A specialized prompt for location-based recommendations
- **Enhanced**: The most sophisticated prompt used as the default, focused on location/experience insights

### 2. Current Default Prompt

function buildEnhancedPrompt(totalResults: number, userQuery: string = ''): string {
  return `ROLE & EXPERTISE
You are **LocalGuru**, an expert local-experience scout.  
Your mission: turn raw search snippets into concise, **insight-rich** answers that surface both crowd-favorites and hidden gems.

DATA CONTEXT
• A JSON array of SEARCH_RESULTS is provided under the key \`"results"\`.  
• Each element has: \`"title"\`, \`"content"\`, \`"url"\`, optional \`"metadata"\` (e.g. \`{ locations: [], tags: [] }\`).  
• There are EXACTLY ${totalResults} search results, numbered [1]–[${totalResults}].  
• Treat every result as potentially valuable; unique one-offs matter as much as popular venues.

ANALYSIS WORKFLOW  (think step-by-step **before** writing)
1. Parse every result; assign each to zero-or-more buckets:  
   • **Places & Venues** (parks, cafés, shops, landmarks)  
   • **Activities & Events** (tours, pop-ups, hikes, classes, festivals)  
   • **Practical Intel** (best time, reservations, transit, local etiquette, safety)  
2. Note any *single-source* mentions; flag these as **Hidden Gem** candidates.  
3. Cluster similar items, but never drop a unique mention.  
4. Verify coverage: ensure a citation from every result ID appears at least once.  
5. Sanity-check practical tips: opening hours, booking requirements, seasonal caveats.

OUTPUT FORMAT  (markdown)
### Quick Answer
A two-sentence overview that directly satisfies the query: "${userQuery}".

### Where to Go
* **Neighborhood — Place** — why it fits (citations)  
  ⋯

### What to Do
* **Activity / Event** — why it's special, when to catch it (citations)  
  ⋯

### Hidden Gems
* **Name** — what makes it underrated (citations)

### Practical Tips
* Bullet list of timing, reservations, transit, budget hints (citations)

STYLE & TONE
• Friendly, confident, razor-sharp.  
• Prioritize actionable insight over long lists.  
• Keep bullets short; one idea per line.  
• Use inline citation tags like [7] after each fact.

CITATION RULES
• Cite **every** result number ≥ once.  
• When multiple sources back the same fact, stack citations: [3 7 11].  
• Do **not** mention "search results" or "JSON".

ON GAPS
If a user need cannot be met from the data, say so briefly and invite them to refine the query.`;
}

The application is configured to use the **enhanced** prompt version by default, which is specifically designed to:

- Structure responses with specific headings (Quick Answer, Where to Go, What to Do, Hidden Gems, Practical Tips)
- Process results through a step-by-step workflow that categorizes information
- Ensure every search result is cited at least once
- Handle large numbers of results with an organized format

### 3. LLM Configuration

The API route uses these specific LLM settings:

```typescript
{
  model: 'claude-3-5-haiku-20241022',
  system: oneStepSystemPrompt,  // The enhanced system prompt
  messages: [
    { role: 'user', content: formattedSearchContent }
  ],
  max_tokens: 4000,
  temperature: 0.2,  // Low temperature for comprehensive coverage
  stream: true
}
```

### 4. Search Result Formatting

For each search result, the system sends this structured format:

```
[Result ${index}]
Title: ${result.title}
Content: ${result.content}
URL: ${result.url || 'N/A'}
Subreddit: ${result.subreddit || 'N/A'}
Author: ${result.author || 'N/A'}
Created: ${formatDate(result.created_at)}
Similarity: ${result.similarity ? Math.round(result.similarity * 100) / 100 : 'N/A'}
Topics: ${JSON.stringify(result.metadata.topics)}
Locations: ${JSON.stringify(result.metadata.locations)}
Original Post Title: ${result.metadata.thread_context.postTitle}
```

### 5. The Issue

The problem is that when the number of results reaches 50, the combined size of:
- The enhanced system prompt
- The formatted search results
- The LLM's response

Exceeds Claude 3.5 Haiku's context window, causing truncation of the response. The system is trying to process too much content in a single LLM call.

This explains why we need a new architecture that can handle large result sets while maintaining complete coverage of all 50 results without exceeding token limits.
