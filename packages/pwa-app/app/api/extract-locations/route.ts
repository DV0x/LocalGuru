import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';
import { API_ROUTES } from '@/app/lib/api/config';

// Simple in-memory cache with a 5-minute expiration
const responseCache = new Map<string, {data: any, timestamp: number}>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Generate a cache key from search results
function generateCacheKey(searchResults: any[]): string {
  if (!searchResults || !searchResults.length) return '';
  const firstId = searchResults[0]?.id || '';
  const lastId = searchResults[searchResults.length - 1]?.id || '';
  return `${firstId}-${lastId}-${searchResults.length}`;
}

export async function POST(request: Request) {
  try {
    const { searchResults } = await request.json();
    
    if (!searchResults || !Array.isArray(searchResults) || searchResults.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or empty search results' },
        { status: 400 }
      );
    }

    // Generate a cache key based on the search results
    const cacheKey = generateCacheKey(searchResults);
    
    // Check if we have a cached response
    const cachedResponse = responseCache.get(cacheKey);
    if (cachedResponse && (Date.now() - cachedResponse.timestamp) < CACHE_TTL) {
      console.log(`Using cached locations for key: ${cacheKey}`);
      return NextResponse.json(cachedResponse.data);
    }
    
    // Call the Supabase Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/extract-locations`;
    
    console.log(`Calling extract-locations function at: ${functionUrl}`);
    console.log(`With ${searchResults.length} search results (key: ${cacheKey})`);
    
    const response = await fetch(
      functionUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ searchResults })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Edge function error (${response.status}):`, errorText);
      return NextResponse.json(
        { error: `Edge function error: ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Cache the response
    responseCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Location extraction error:', error);
    
    return NextResponse.json(
      { error: 'Failed to extract locations' },
      { status: 500 }
    );
  }
}

// Also handle GET requests for easier testing
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const snippetParam = searchParams.get('snippet');
  
  if (!snippetParam) {
    return NextResponse.json(
      { error: 'Missing snippet parameter' },
      { status: 400 }
    );
  }
  
  const mockSearchResult = {
    id: 'test-id',
    title: 'Test snippet',
    snippet: snippetParam
  };
  
  try {
    // Call the POST handler with our mock data
    const mockRequest = new Request('http://localhost', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ searchResults: [mockSearchResult] })
    });
    
    return await POST(mockRequest);
  } catch (error) {
    console.error('GET handler error:', error);
    
    return NextResponse.json(
      { error: 'Failed to process test request' },
      { status: 500 }
    );
  }
} 