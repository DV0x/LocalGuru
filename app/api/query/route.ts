import { NextRequest, NextResponse } from 'next/server';
import { semanticSearch, logQuery } from '@/lib/services/semantic-search';
import { generateTravelRecommendation } from '@/lib/services/recommendation-generator';
import { searchReddit } from '@/lib/reddit/client';
import { QueryRequest, QueryResponse, RedditPost } from '@/lib/types';

/**
 * API route handler for /api/query
 * Processes user queries and returns travel recommendations
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse the request body
    const body: QueryRequest = await request.json();
    const { query, limit = 5 } = body;

    // Validate the query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Trim and normalize the query
    const normalizedQuery = query.trim();
    
    // Log the start time for performance tracking
    const startTime = Date.now();
    
    let relevantPosts: RedditPost[] = [];
    
    try {
      // Try to get relevant posts from the semantic search
      relevantPosts = await semanticSearch(normalizedQuery, limit);
      
      // If we don't have enough results, supplement with a direct Reddit search
      if (relevantPosts.length < limit) {
        const redditPosts = await searchReddit(normalizedQuery, limit - relevantPosts.length);
        
        // Combine the results, avoiding duplicates
        const existingIds = new Set(relevantPosts.map(post => post.id));
        for (const post of redditPosts) {
          if (!existingIds.has(post.id)) {
            relevantPosts.push(post);
            existingIds.add(post.id);
          }
          
          // Stop once we have enough posts
          if (relevantPosts.length >= limit) break;
        }
      }
    } catch (searchError) {
      console.error('Error in search process:', searchError);
      
      // Fallback to direct Reddit search if semantic search fails
      try {
        relevantPosts = await searchReddit(normalizedQuery, limit);
      } catch (redditError) {
        console.error('Error in Reddit search fallback:', redditError);
        // Continue with empty results if both search methods fail
      }
    }
    
    // Generate recommendations based on the relevant posts
    const recommendations = await generateTravelRecommendation(normalizedQuery, relevantPosts);
    
    // Log the query for analytics
    await logQuery(normalizedQuery, relevantPosts.length);
    
    // Calculate the response time
    const responseTime = Date.now() - startTime;
    console.log(`Query processed in ${responseTime}ms: "${normalizedQuery}"`);
    
    // Return the response
    const response: QueryResponse = {
      recommendations,
      // Include related topics if available
      relatedTopics: recommendations.length > 0 
        ? recommendations[0].highlights.map(h => h.split(':')[0]) 
        : undefined
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing query:', error);
    
    return NextResponse.json(
      { error: 'Failed to process query. Please try again later.' },
      { status: 500 }
    );
  }
}

/**
 * API route handler for OPTIONS requests (CORS preflight)
 */
export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 