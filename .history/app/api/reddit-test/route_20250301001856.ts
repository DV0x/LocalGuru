import { NextRequest, NextResponse } from 'next/server';
import { searchReddit } from '@/lib/reddit/client';

/**
 * Test API endpoint to verify Reddit API functionality
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const redditPosts = await searchReddit('best places to visit in europe', 2);
    
    return NextResponse.json({
      success: true,
      data: redditPosts.slice(0, 2), // Just return 2 posts to keep the response small
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error testing Reddit API:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error with Reddit API',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 