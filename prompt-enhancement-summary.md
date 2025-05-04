# Search Synthesis Prompt Enhancement: Technical Documentation

## Problem Statement

The AI response system was not utilizing all 50 search results in its synthesis, leading to:
- Missing key locations and venues
- Omitting important practical details
- Skipping unique activities and special events
- Producing lists without sufficient insights and context

## Original System Prompt

Before our enhancements, the system was using the following prompt from the `buildEnhancedPrompt` function in `app/lib/prompts/search-synthesis-prompt.ts`:

```typescript
function buildEnhancedPrompt(totalResults: number, userQuery: string = ''): string {
  const queryContext = userQuery ? `responding to the query: "${userQuery}"` : 'answering the user query';

  // Element 1: Task Context
  const TASK_CONTEXT = `You are LocalGuru, a local search assistant that provides concise, accurate information about local places, activities, and services. Your responses should be conversational but focused on ${queryContext}.`;
  
  // Element 2: Tone Context
  const TONE_CONTEXT = `Maintain a friendly, helpful tone. Be concise but thorough, and focus on the most relevant details in your answers. Use a voice that's informative without being overly formal.`;
  
  // Element 3: Input Data Context
  const INPUT_DATA = `I will analyze ALL ${totalResults} search results provided and extract information from EVERY result to comprehensively answer the user's query${userQuery ? `: "${userQuery}"` : ''}.`;
  
  // Element 5: Detailed Task Description
  const TASK_DESCRIPTION = `
Your job is to:
1. Analyze ALL ${totalResults} search results thoroughly - EVERY SINGLE ONE contains valuable information
2. Extract information from EVERY result to comprehensively answer the user's query
3. Present a concise, organized response that addresses all parts of their question
4. Only include information found in the search results
5. If the search results don't contain information needed to fully answer the query, acknowledge this in your response
6. Use citation numbers that EXACTLY match the result indices [1], [2], etc.

When multiple sources provide similar information:
- Synthesize them into a cohesive answer
- Cite all relevant sources
- Note when there's strong consensus on a particular point
- Highlight any contradictions or discrepancies between sources
`;
  
  // Element 6: Immediate Task Description
  const IMMEDIATE_TASK = `Based on ALL the search results provided, answer the user's query completely and comprehensively. You MUST include information from AT LEAST 25-30 different results to provide thorough coverage, and attempt to cite ALL ${totalResults} results when possible.`;
  
  // Element 7: Precognition (Step-by-Step Analysis)
  const PRECOGNITION = `
Before answering, analyze the search results using these steps:
1. Identify which results contain information relevant to each part of the user's query
2. DO NOT prioritize information based solely on similarity scores - unique mentions are equally important
3. Extract key facts and details from EVERY result, including those with single mentions of locations or services
4. Group similar information from different sources, but don't omit unique mentions
5. Organize these facts in a logical order for your response
6. Ensure EVERY result is represented in your final answer with at least one citation
7. Pay special attention to results marked as "IMPORTANT UNIQUE MENTION"
`;
  
  // Element 8: Output Formatting
  const OUTPUT_FORMATTING = `
FORMAT YOUR RESPONSE FOLLOWING THESE GUIDELINES:
- Use markdown formatting for readability
- Create clear section headings for different aspects of the answer
- Use bullet points for lists of options or features
- Include citations as [1], [2], etc. that correspond exactly to result numbers
- When multiple sources mention the same information, cite all of them: [1, 5, 12]
- Organize information logically based on relevance to the query
- For location-based queries, organize by neighborhood or area when appropriate
- Start with a direct answer, then provide supporting details
- End with practical advice or a summary related to the query
`;
  
  // Combine all sections
  return `${TASK_CONTEXT}

${TONE_CONTEXT}

${INPUT_DATA}

${TASK_DESCRIPTION}

${IMMEDIATE_TASK}

${PRECOGNITION}

${OUTPUT_FORMATTING}

IMPORTANT REMINDER:
- CRITICAL: You MUST include information from ALL ${totalResults} search results - each contains valuable information
- Every result should be cited at least once in your response
- Never make up information not found in the search results
- Do not mention that you're analyzing "search results" in your response
- Cite at least 25-30 different sources throughout your response, aiming for complete coverage
- Do not prioritize frequently mentioned locations over unique mentions
- Ensure all citations match the exact result numbers provided
- Pay special attention to unique mentions that only appear in a single result
`;
}
```

### Key Limitations of the Original Prompt:

- Lacked specific categorization of content types (locations, restaurants, activities)
- Did not explicitly highlight important information in each result
- Had weaker verification mechanisms for ensuring full coverage
- Used a higher temperature setting (0.7) that allowed more creative but less thorough responses
- Did not emphasize the need for insights over listings
- Did not specifically require practical details and special activities to be included

## Solution Approach

We implemented a comprehensive single-step solution that optimizes both result coverage and response quality without adding latency. Our approach focused on three key areas:

1. **Enhanced Content Categorization**: Automatically identify and extract key information categories
2. **Improved Prompt Engineering**: Restructure prompts to emphasize insights over lists
3. **Verification Process**: Add explicit verification steps for the AI to check coverage

## Detailed Code Changes

### 1. Enhanced `formatSearchResultsForLLM` Function (`app/lib/search/stream-processor.ts`)

The function was completely redesigned to automatically categorize information and structure the prompt accordingly:

```typescript
export function formatSearchResultsForLLM(
  results: SearchResult[] | CommentSearchResult[],
  query: string
): string {
  // Extract and categorize key elements from results for emphasis
  const locationMentions = new Map<string, number[]>();
  const restaurantMentions = new Map<string, number[]>();
  const activitiesMentions = new Map<string, number[]>();
  const practicalDetails: number[] = [];
  
  // Process each result to find key information
  results.forEach((result, index) => {
    const resultIdx = index + 1;
    const content = result.content?.toLowerCase() || '';
    
    // Extract locations from metadata and content
    if (result.metadata?.locations?.length) {
      result.metadata.locations.forEach(loc => {
        if (!locationMentions.has(loc)) locationMentions.set(loc, []);
        locationMentions.get(loc)?.push(resultIdx);
      });
    }
    
    // Extract restaurants
    if (content.includes('restaurant') || content.includes('food') || 
        content.includes('eat') || content.includes('dining')) {
      const idx = resultIdx;
      restaurantMentions.set(`Result #${idx}`, [idx]);
    }
    
    // Extract activities
    if (content.includes('tour') || content.includes('event') || 
        content.includes('show') || content.includes('activity') ||
        content.includes('hike') || content.includes('watch')) {
      const idx = resultIdx;
      activitiesMentions.set(`Result #${idx}`, [idx]);
    }
    
    // Extract practical details
    if (content.includes('reservation') || content.includes('book') || 
        content.includes('time') || content.includes('hour') ||
        content.includes('weather') || content.includes('season') ||
        content.includes('early') || content.includes('first come')) {
      practicalDetails.push(resultIdx);
    }
  });
```

#### Key Improvements:
- **Categorization System**: Automatically identifies and tracks different information types
- **Entity Extraction**: Extracts locations, restaurants, activities, and practical details
- **Result Tracking**: Maps content types to result numbers for coverage verification
- **Keyword Detection**: Uses keyword matching to identify important content categories

### 2. Enhanced Prompt Structure

The prompt was redesigned with a clearer structure that emphasizes both comprehensive coverage and insightful analysis:

```typescript
// Build instructional header emphasizing comprehensive analysis
const header = `
Query: "${query}"

CRITICAL INSTRUCTIONS:
You MUST provide a comprehensive, insightful analysis that incorporates ALL ${results.length} search results.
The user wants valuable insights and recommendations, not just a list of places.

ANALYSIS REQUIREMENTS:
1. Include EVERY location, restaurant, venue, and activity mentioned in the results
2. Provide context, practical details, and recommendations based on the search data
3. Cite ALL result numbers [1] through [${results.length}] at least once
4. Create meaningful connections between related information

KEY CONTENT CATEGORIES TO INCLUDE:
* LOCATIONS: ${Array.from(locationMentions.keys()).join(', ')}
* RESTAURANTS/FOOD: ${Array.from(restaurantMentions.keys()).join(', ')}
* ACTIVITIES/EVENTS: ${Array.from(activitiesMentions.keys()).join(', ')}
* PRACTICAL DETAILS: Results ${practicalDetails.join(', ')} contain important logistics information
`;
```

#### Key Improvements:
- **Explicit Category Listing**: Explicitly lists all detected entities by category
- **Insight Emphasis**: Shifts focus from listing to providing insights and connections
- **Comprehensive Coverage**: Maintains emphasis on including all results
- **User-Focused Instructions**: Clarifies that users want insights, not just lists

### 3. Enhanced Result Highlighting

Each search result is now tagged with content-specific markers to ensure important information isn't missed:

```typescript
// Format each result with highlighting based on content type
const formattedResults = results.map((result, index) => {
  const resultNumber = index + 1;
  const locationHighlight = result.metadata?.locations?.length ? 
    "LOCATION MENTION - " : "";
  const restaurantHighlight = result.content?.toLowerCase().includes('restaurant') ?
    "RESTAURANT MENTION - " : "";
  const activityHighlight = result.content?.toLowerCase().includes('tour') || 
                            result.content?.toLowerCase().includes('event') ||
                            result.content?.toLowerCase().includes('show') ?
    "ACTIVITY/EVENT MENTION - " : "";
  const practicalHighlight = result.content?.toLowerCase().includes('reservation') ||
                              result.content?.toLowerCase().includes('time') ?
    "PRACTICAL DETAIL - " : "";
                            
  const highlightPrefix = locationHighlight || restaurantHighlight || 
                          activityHighlight || practicalHighlight;
  
  return `
[Result ${resultNumber}] - RESULT ID #${resultNumber} - MUST INCLUDE
${highlightPrefix}Title: ${result.title}
...
`;
```

#### Key Improvements:
- **Content Tagging**: Tags each result with content-specific markers
- **Multiple Categories**: Identifies multiple possible content types in each result
- **Must-Include Marker**: Explicitly marks each result as required
- **Result ID Emphasis**: Makes result numbers more prominent

### 4. Enhanced Response Structure Requirements

Added detailed instructions for response structure and verification:

```typescript
// Add detailed processing instructions at the end
const footer = `
Based on these search results, provide a comprehensive, insightful answer to the query: "${query}"

RESPONSE STRUCTURE REQUIREMENTS:
1. Start with a brief overview answering the query directly
2. Create meaningful sections that group related information while ensuring COMPLETE coverage
3. Include dedicated sections for:
   - Main locations/venues
   - Special activities and experiences
   - Practical planning tips
   - Food and dining options (if relevant)
4. Cite EVERY result number [1] through [${results.length}] at least once
5. Use citations like [1], [2], etc. to reference specific results
6. When multiple sources mention the same information, cite all of them: [1, 5, 12]
7. Conclude with specific, actionable recommendations

VERIFICATION PROCESS:
Before finalizing your response, verify you've included:
- Every location, restaurant, venue, and activity mentioned in ANY result
- All practical details about reservations, timing, or seasonal considerations
- Information from results across the entire range (beginning, middle, and end of results)
- Citations for ALL ${results.length} results
`;
```

#### Key Improvements:
- **Structured Response**: Requires specific sections for different content types
- **Verification Process**: Adds explicit verification checklist for the AI
- **Citation Requirements**: Maintains emphasis on citing all results
- **Range Coverage**: Specifically requires checking the beginning, middle, and end of results

### 5. Enhanced API Parameters (`app/api/streaming-search/route.ts`)

Created an enhanced one-step system prompt with verification requirements:

```typescript
// Create an enhanced one-step system prompt
const oneStepSystemPrompt = `${systemPrompt}

CRITICAL ANALYSIS REQUIREMENTS:
1. You MUST analyze and incorporate information from EACH numbered result [1] through [${searchResponse.results.length}].
2. You are a local SF expert. Your job is to provide INSIGHTS, not just listings. Make connections between locations and add meaningful context.
3. LOCATIONS: Include EVERY park, beach, restaurant, attraction, and venue mentioned in ANY result.
4. PRACTICAL DETAILS: Include reservation requirements, timing info, seasonal considerations, and access details.
5. SPECIAL ACTIVITIES: Mention ALL special events, shows, tours, and unique experiences found in the results.

FORMAT REQUIREMENTS:
- Create insightful sections that group similar information while ensuring COMPLETE coverage
- Include a "Special Venues & Activities" section for unique experiences
- Include a "Practical Planning Tips" section with logistical details
- Your response should be comprehensive but provide genuine insights, not just lists
- Cite EVERY result number at least once

VERIFICATION PROCESS - Before finalizing your response:
1. Mentally track which results you've used
2. Specifically check for items in results #1-10, #20-30, and #40-50 to ensure full coverage
3. Verify you've included all restaurants, events, and activities mentioned
4. Ensure practical details like reservations, timing are covered
`;

// API parameters
const requestBody = {
  model: 'claude-3-5-haiku-20241022',
  system: oneStepSystemPrompt,
  messages: [
    { role: 'user', content: formattedSearchContent }
  ],
  max_tokens: 4000,
  temperature: 0.2, // Lower temperature for more comprehensive coverage
  stream: true
};
```

#### Key Improvements:
- **Lower Temperature**: Reduced from 0.3 to 0.2 for more comprehensive coverage
- **Enhanced System Prompt**: Added extensive instructions for analysis, format, and verification
- **Expert Framing**: Positioned the AI as a local SF expert to emphasize insights
- **Required Sections**: Explicitly required sections for special activities and practical tips

## Expected Outcomes

The enhanced prompt system should produce responses that:

1. Include **ALL** locations, restaurants, and activities mentioned in the search results
2. Provide genuine insights and connections between places, not just listings
3. Include all practical information about reservations, timing, and seasonal considerations
4. Have a well-structured format with dedicated sections for different content types
5. Cite ALL 50 search results at least once

## Testing the Changes

To test the effectiveness of these changes:

1. Make a search query related to locations (e.g., "best parks for picnic in San Francisco")
2. Check if the response includes all locations mentioned in the search results
3. Verify that practical details (reservations, timing) are included
4. Check citation coverage to ensure all results are referenced
5. Evaluate whether the response provides insights beyond simple listings

## Future Improvements

Potential future enhancements could include:

1. **Entity Extraction API**: Implement a dedicated NLP entity extraction system for more accurate categorization
2. **Response Analysis**: Add post-processing to analyze response quality and coverage
3. **Adaptive Temperature**: Dynamically adjust temperature based on query complexity and result count
4. **Interactive Refinement**: Allow users to request more information about specific aspects mentioned in the response 

## Appendix: Actual Search Results Structure

The following is the actual search results data structure that our enhanced prompt system processes, obtained from the diagnostic endpoint. This shows the real data that prompt engineers need to work with:

```json
{
  "requestBody": {
    "model": "claude-3-5-haiku-20241022",
    "system": "You are LocalGuru, a local search assistant that provides concise, accurate information about local places, activities, and services. Your responses should be conversational but focused on responding to the query: \"best parks for picnic in San Francisco\"...",
    "messages": [
      {
        "role": "user",
        "content": "Query: \"best parks for picnic in San Francisco\"\n\nCRITICAL INSTRUCTIONS:\nYou MUST provide a comprehensive, insightful analysis that incorporates ALL 5 search results.\nThe user wants valuable insights and recommendations, not just a list of places.\n\nANALYSIS REQUIREMENTS:\n1. Include EVERY location, restaurant, venue, and activity mentioned in the results\n2. Provide context, practical details, and recommendations based on the search data\n3. Cite ALL result numbers [1] through [5] at least once\n4. Create meaningful connections between related information\n\nKEY CONTENT CATEGORIES TO INCLUDE:\n* LOCATIONS: \n* RESTAURANTS/FOOD: Result #3\n* ACTIVITIES/EVENTS: \n* PRACTICAL DETAILS: Results 1, 3 contain important logistics information\n\nSearch Results:\n[Result 1] - RESULT ID #1 - MUST INCLUDE\nTitle: Planning my 27th birthday - Picnic Area Reccos?\nContent: GG park is probably the easiest. Alamo Square has a few picnic tables at the top that I'd vote most scenic picnic tables in SF. First come first serve though. I regularly see people grab one for a party.\nURL: https://reddit.com/comments/1jvpzqo\nSubreddit: AskSF\nAuthor: joshuaxls\nCreated: 4/10/2025\nSimilarity: 0.46\nTopics: []\nLocations: []\nOriginal Post Title: Planning my 27th birthday - Picnic Area Reccos?\n\n[Result 2] - RESULT ID #2 - MUST INCLUDE\nTitle: Planning my 27th birthday - Picnic Area Reccos?\nContent: Seconded. Reserve a picnic area 90 days before or they'll sell out quickly\nURL: https://reddit.com/comments/1jvpzqo\nSubreddit: AskSF\nAuthor: brittanybob20\nCreated: 4/10/2025\nSimilarity: 0.43\nTopics: []\nLocations: []\nOriginal Post Title: Planning my 27th birthday - Picnic Area Reccos?\n\n[Result 3] - RESULT ID #3 - MUST INCLUDE\nTitle: Planning my 27th birthday - Picnic Area Reccos?\nContent: Crane Cove Park - you're most likely to get great weather there too.\nURL: https://reddit.com/comments/1jvpzqo\nSubreddit: AskSF\nAuthor: nattylite100\nCreated: 4/10/2025\nSimilarity: 0.43\nTopics: []\nLocations: []\nOriginal Post Title: Planning my 27th birthday - Picnic Area Reccos?\n\n[Result 4] - RESULT ID #4 - MUST INCLUDE\nTitle: Planning my 27th birthday - Picnic Area Reccos?\nContent: What spot at GG park? There are just too many! HAving tables is not necessarily a must for me.\nURL: https://reddit.com/comments/1jvpzqo\nSubreddit: AskSF\nAuthor: RichOil4397\nCreated: 4/11/2025\nSimilarity: 0.42\nTopics: []\nLocations: []\nOriginal Post Title: Planning my 27th birthday - Picnic Area Reccos?\n\n[Result 5] - RESULT ID #5 - MUST INCLUDE\nTitle: Planning my 27th birthday - Picnic Area Reccos?\nContent: Hellman hollow\nURL: https://reddit.com/comments/1jvpzqo\nSubreddit: AskSF\nAuthor: The_bussy\nCreated: 4/10/2025\nSimilarity: 0.42\nTopics: []\nLocations: []\nOriginal Post Title: Planning my 27th birthday - Picnic Area Reccos?"
      }
    ],
    "max_tokens": 4000,
    "temperature": 0.7,
    "stream": true
  },
  "searchResultsCount": 5,
  "formattedContentSample": "...",
  "fullContent": "..."
}
```

### Key Observations for Prompt Optimization

When enhancing prompts, prompt engineers should consider these important observations:

1. **Limited Metadata**:
   - Many metadata fields are currently empty (`topics: []`, `locations: []`)
   - Location names must be extracted from the content text itself
   - Our enhanced system adds content categorization labels (e.g., "RESTAURANTS/FOOD: Result #3")

2. **Result Structure**:
   - Results often come from the same source thread (in this case, all from one Reddit thread)
   - Similarity scores are relatively close (0.42-0.46 in this example)
   - Many results are short comments rather than detailed posts

3. **Content Tagging**:
   - The system identifies which results contain important logistics information
   - Results with restaurant/food information are explicitly tagged
   - The system adds "MUST INCLUDE" tags to emphasize all results should be used

4. **Locations Mentioned**:
   - Golden Gate Park (referred to as "GG park")
   - Alamo Square
   - Crane Cove Park
   - Hellman Hollow

Based on these observations, prompt engineers should focus on:

1. **Extracting implicit information**: Since metadata is often sparse, develop prompts that encourage extraction of location names and other entities directly from the content text.

2. **Emphasizing content categories**: The content categorization we've added helps guide the AI to identify important information types - build on this approach.

3. **Managing result similarity**: When results have similar scores and come from the same thread, create prompts that emphasize the unique contribution of each result.

4. **Handling abbreviated names**: Develop prompts that recognize abbreviated location names (e.g., "GG park" vs "Golden Gate Park").

5. **Verifying complete coverage**: Given the limited metadata, strengthen verification steps to ensure every location and detail is included. 