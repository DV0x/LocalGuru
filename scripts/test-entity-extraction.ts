// Script to test entity extraction functionality
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Interface for entity extraction result
interface EntityExtractionResult {
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

// Entity extraction function (simplified version of the edge function)
async function extractEntities(
  text: string,
  contentType: 'post' | 'comment',
  contextInfo?: {
    subreddit?: string;
    title?: string;
    postTitle?: string;
  }
): Promise<EntityExtractionResult> {
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

    console.log("Sending extraction prompt to OpenAI...");
    
    // Call OpenAI API for entity extraction
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125', // Using 3.5 for cost efficiency
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

// Test function to extract entities from sample posts
async function testEntityExtraction() {
  console.log("Starting entity extraction test...");
  
  try {
    // Fetch some sample posts from the database
    const { data: posts, error } = await supabase
      .from('reddit_posts')
      .select('id, title, content, subreddit')
      .limit(3);
    
    if (error) {
      throw error;
    }
    
    if (!posts || posts.length === 0) {
      console.log("No posts found for testing");
      return;
    }
    
    console.log(`Found ${posts.length} posts for testing`);
    
    // Process each post
    for (const post of posts) {
      console.log(`\nProcessing post: ${post.title}`);
      
      const contentText = `${post.title}\n\n${post.content || ''}`;
      console.log(`Content length: ${contentText.length} characters`);
      
      // Extract entities
      const extractionResult = await extractEntities(
        contentText,
        'post',
        { subreddit: post.subreddit, title: post.title }
      );
      
      // Output the results
      console.log("\nExtraction Results:");
      console.log(`Topics (${extractionResult.topics.length}):`, extractionResult.topics);
      console.log(`Locations (${extractionResult.locations.length}):`, extractionResult.locations);
      console.log(`Semantic Tags (${extractionResult.semanticTags.length}):`, extractionResult.semanticTags);
      console.log("Entity Types:", Object.keys(extractionResult.entities));
      
      // Save the full result to a file for inspection
      const resultDir = './test-results';
      if (!fs.existsSync(resultDir)) {
        fs.mkdirSync(resultDir);
      }
      
      fs.writeFileSync(
        `${resultDir}/entity-extraction-${post.id}.json`,
        JSON.stringify(extractionResult, null, 2)
      );
      
      console.log(`Results saved to: ${resultDir}/entity-extraction-${post.id}.json`);
      
      // Simulate updating the database (optional)
      /*
      await supabase
        .from('reddit_posts')
        .update({
          extracted_entities: extractionResult.entities,
          extracted_topics: extractionResult.topics,
          extracted_locations: extractionResult.locations,
          semantic_tags: extractionResult.semanticTags
        })
        .eq('id', post.id);
      */
    }
    
    console.log("\nEntity extraction test completed successfully");
  } catch (error) {
    console.error("Error during entity extraction test:", error);
  }
}

// Run the test
testEntityExtraction(); 