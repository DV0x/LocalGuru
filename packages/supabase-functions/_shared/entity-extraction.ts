// Entity extraction utilities for Localguru
// This utility uses OpenAI to extract structured information from content

import OpenAI from 'npm:openai@4.20.1';

/**
 * Structured result from entity extraction
 */
export interface EntityExtractionResult {
  entities: {
    people?: string[];
    organizations?: string[];
    places?: string[];
    concepts?: string[];
    products?: string[];
    events?: string[];
  };
  topics: string[];
  locations: string[];
  semanticTags: string[];
}

/**
 * Extract entities, topics, locations and semantic tags from text content
 * 
 * @param text - The text content to analyze
 * @param contentType - Type of content ('post' or 'comment')
 * @param contextInfo - Additional context about the content
 * @returns Structured information extracted from the content
 */
export async function extractEntities(
  text: string,
  contentType: 'post' | 'comment',
  contextInfo?: {
    subreddit?: string;
    title?: string;
    postTitle?: string;
  }
): Promise<EntityExtractionResult> {
  // Initialize OpenAI
  const openai = new OpenAI({
    apiKey: Deno.env.get('OPENAI_API_KEY'),
  });

  // Default return structure in case of errors
  const defaultResult: EntityExtractionResult = {
    entities: {},
    topics: [],
    locations: [],
    semanticTags: []
  };

  try {
    // Handle empty content
    if (!text || text.trim().length === 0) {
      console.log('Empty content provided for entity extraction');
      return defaultResult;
    }

    // Truncate text if too long (to stay within token limits)
    const truncatedText = text.length > 4000 
      ? text.substring(0, 4000) + '...' 
      : text;

    // Build context-aware prompt
    let contextualInfo = '';
    if (contentType === 'post') {
      contextualInfo = `This is a Reddit post${contextInfo?.subreddit ? ` from r/${contextInfo.subreddit}` : ''}.`;
      if (contextInfo?.title) {
        contextualInfo += ` The title is: "${contextInfo.title}"`;
      }
    } else {
      contextualInfo = `This is a Reddit comment${contextInfo?.subreddit ? ` from r/${contextInfo.subreddit}` : ''}.`;
      if (contextInfo?.postTitle) {
        contextualInfo += ` Responding to a post titled: "${contextInfo.postTitle}"`;
      }
    }

    // Create prompt for extraction
    const prompt = `${contextualInfo}
    
Extract structured information from the following content:

"""
${truncatedText}
"""

Focus on travel-related entities, topics, and locations. Identify all of the following:

1. Named entities (people, organizations, places, concepts, products, events)
2. Main topics discussed (5 max, be specific)
3. Geographic locations mentioned (countries, cities, regions, landmarks)
4. Semantic tags (5-8 descriptive tags that categorize this content)

Return ONLY a JSON object with this structure, nothing else:
{
  "entities": {
    "people": ["name1", "name2", ...],
    "organizations": ["org1", "org2", ...],
    "places": ["place1", "place2", ...],
    "concepts": ["concept1", "concept2", ...],
    "products": ["product1", "product2", ...],
    "events": ["event1", "event2", ...]
  },
  "topics": ["topic1", "topic2", ...],
  "locations": ["location1", "location2", ...],
  "semanticTags": ["tag1", "tag2", ...]
}

Only include categories that have values. If no entities of a certain type are found, omit that property entirely.`;

    // Call OpenAI API for entity extraction
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125', // Using 3.5 for cost efficiency on this task
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent outputs
    });

    // Parse the response
    const content = response.choices[0].message.content;
    if (!content) {
      console.error('Empty response from OpenAI');
      return defaultResult;
    }

    // Parse JSON response
    const result = JSON.parse(content) as EntityExtractionResult;
    
    // Ensure we have all the expected properties with default values
    return {
      entities: result.entities || {},
      topics: result.topics || [],
      locations: result.locations || [],
      semanticTags: result.semanticTags || []
    };
  } catch (error) {
    console.error('Error extracting entities:', error);
    return defaultResult;
  }
} 