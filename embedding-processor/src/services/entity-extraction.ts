// src/services/entity-extraction.ts
import { OpenAI } from 'openai';
import { EntityExtractionResult } from './types';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract entities using GPT-3.5 Turbo (cost optimization)
 */
export async function extractEntities(
  content: string,
  contentType: 'post' | 'comment',
  context: {
    subreddit?: string;
    title?: string;
    postTitle?: string;
  }
): Promise<EntityExtractionResult> {
  try {
    console.log(`Extracting entities for ${contentType} with GPT-3.5 Turbo...`);
    
    // Create a prompt with context for better extraction
    const contextString = [
      context.subreddit ? `Subreddit: r/${context.subreddit}` : '',
      context.title ? `Title: ${context.title}` : '',
      context.postTitle ? `Post Title: ${context.postTitle}` : '',
    ].filter(Boolean).join('\n');
    
    // Use GPT-3.5 Turbo for cost-effective entity extraction
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting structured information from text.
          Extract entities, topics, locations, and semantic tags from the provided content.
          Be specific and concise. Return only a valid JSON object with no additional text.`
        },
        {
          role: 'user',
          content: `Extract structured information from this ${contentType}:
          
${contextString}

Content: ${content}

Return a JSON object with this structure:
{
  "entities": {
    "people": [],
    "organizations": [],
    "products": [],
    "technologies": [],
    "events": [],
    "other": []
  },
  "topics": [],
  "locations": [],
  "semanticTags": []
}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    // Parse the JSON response
    const resultContent = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(resultContent) as EntityExtractionResult;
    
    return {
      entities: result.entities || {},
      topics: result.topics || [],
      locations: result.locations || [],
      semanticTags: result.semanticTags || []
    };
  } catch (error) {
    console.error('Error extracting entities:', error);
    // Return empty result on error
    return {
      entities: {},
      topics: [],
      locations: [],
      semanticTags: []
    };
  }
} 