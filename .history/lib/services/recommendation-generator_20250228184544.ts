import { generateResponse } from '../openai/client';
import { RedditPost, TravelRecommendation } from '../types';

/**
 * Generate a travel recommendation based on the user query and relevant Reddit posts
 * @param query The user's query
 * @param relevantPosts Array of relevant Reddit posts
 * @returns A structured travel recommendation
 */
export async function generateTravelRecommendation(
  query: string,
  relevantPosts: RedditPost[]
): Promise<TravelRecommendation[]> {
  try {
    // Extract relevant content from the posts
    const postContents = relevantPosts.map(post => {
      return `
Title: ${post.title}
Content: ${post.selftext.substring(0, 1000)}
URL: https://reddit.com${post.permalink}
Subreddit: r/${post.subreddit}
`;
    }).join('\n---\n');

    // Create a prompt for the LLM
    const prompt = `
You are a travel expert assistant. Based on the user's query and the following Reddit posts about travel, 
generate a detailed and helpful travel recommendation. Format your response as JSON.

USER QUERY: ${query}

RELEVANT REDDIT POSTS:
${postContents}

Generate a JSON response with the following structure:
{
  "recommendations": [
    {
      "title": "A concise title for the recommendation",
      "description": "A detailed description of the recommendation (2-3 paragraphs)",
      "highlights": ["Key highlight 1", "Key highlight 2", "Key highlight 3"],
      "tips": ["Practical tip 1", "Practical tip 2", "Practical tip 3"],
      "source": "Source of this information (e.g., Reddit username)",
      "sourceUrl": "URL to the source"
    }
  ],
  "relatedTopics": ["Related topic 1", "Related topic 2", "Related topic 3"]
}

Ensure your response is ONLY valid JSON with no additional text or explanation.
`;

    // Generate a response using the LLM
    const llmResponse = await generateResponse(prompt);
    
    // Parse the JSON response
    try {
      const parsedResponse = JSON.parse(llmResponse);
      return parsedResponse.recommendations || [];
    } catch (parseError) {
      console.error('Error parsing LLM response as JSON:', parseError);
      
      // Fallback: Create a simple recommendation if JSON parsing fails
      return [{
        title: 'Travel Recommendation',
        description: llmResponse.substring(0, 500),
        highlights: ['Based on user query'],
        tips: ['Check more details on Reddit'],
        source: 'AI Assistant',
      }];
    }
  } catch (error) {
    console.error('Error generating travel recommendation:', error);
    throw new Error('Failed to generate travel recommendation');
  }
} 