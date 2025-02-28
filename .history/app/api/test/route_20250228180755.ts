import { NextRequest, NextResponse } from 'next/server';
import { searchReddit } from '@/lib/reddit/client';
import { generateResponse } from '@/lib/openai/client';

interface TestResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

interface TestResults {
  reddit: TestResult<any[]>;
  openai: TestResult<string>;
}

/**
 * Test API endpoint to verify credentials and API functionality
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const results: TestResults = {
    reddit: { success: false, data: null, error: null },
    openai: { success: false, data: null, error: null },
  };

  // Test Reddit API
  try {
    // Search for a simple travel-related query
    const redditPosts = await searchReddit('best places to visit in europe', 2);
    results.reddit = {
      success: true,
      data: redditPosts.slice(0, 2), // Just return 2 posts to keep the response small
      error: null
    };
  } catch (error: any) {
    results.reddit = {
      success: false,
      data: null,
      error: error.message || 'Unknown error with Reddit API'
    };
  }

  // Test OpenAI API
  try {
    const response = await generateResponse('What are some popular tourist destinations in Paris?');
    results.openai = {
      success: true,
      data: response.substring(0, 100) + '...', // Just return a snippet
      error: null
    };
  } catch (error: any) {
    results.openai = {
      success: false,
      data: null,
      error: error.message || 'Unknown error with OpenAI API'
    };
  }

  return NextResponse.json({
    message: 'API Test Results',
    timestamp: new Date().toISOString(),
    results
  });
} 