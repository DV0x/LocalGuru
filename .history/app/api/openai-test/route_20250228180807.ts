import { NextRequest, NextResponse } from 'next/server';
import { generateResponse } from '@/lib/openai/client';

/**
 * Test API endpoint to verify OpenAI API functionality
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const response = await generateResponse('What are some popular tourist destinations in Paris?');
    
    return NextResponse.json({
      success: true,
      data: response.substring(0, 100) + '...', // Just return a snippet
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error testing OpenAI API:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error with OpenAI API',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 