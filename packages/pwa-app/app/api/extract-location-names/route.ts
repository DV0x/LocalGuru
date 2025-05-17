import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

// Simple in-memory cache with a 5-minute expiration
const responseCache = new Map<string, {data: any, timestamp: number}>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Generate a cache key from text
function generateCacheKey(text: string): string {
  if (!text) return '';
  return `text-${text.slice(0, 50)}-${text.length}`;
}

export async function POST(request: Request) {
  try {
    const { text, texts, source, metadata } = await request.json();
    
    // Handle both single text and array of texts
    const textItems = texts || (text ? [{ text, source, metadata }] : []);
    
    if (!textItems || textItems.length === 0) {
      return NextResponse.json(
        { error: 'No text provided for location extraction' },
        { status: 400 }
      );
    }

    // Process all text items
    const extractionPromises = textItems.map(async (item: any) => {
      const { text, source = 'api', metadata = {} } = item;
      
      // Skip empty items
      if (!text) return null;
      
      // Generate a cache key for this text
      const cacheKey = generateCacheKey(text);
      
      // Check if we have a cached response
      const cachedResponse = responseCache.get(cacheKey);
      if (cachedResponse && (Date.now() - cachedResponse.timestamp) < CACHE_TTL) {
        console.log(`Using cached locations for text: ${text.slice(0, 30)}...`);
        return cachedResponse.data;
      }
      
      // Call the Supabase Edge Function
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/extract-locations`;
      
      console.log(`Calling extract-locations function for text: ${text.slice(0, 30)}...`);
      
      const response = await fetch(
        functionUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ 
            text,
            source,
            metadata
          })
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Edge function error (${response.status}):`, errorText);
        throw new Error(`Edge function error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Cache the response
      responseCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    });
    
    // Wait for all extractions to complete
    const results = await Promise.all(extractionPromises);
    
    // Combine all locations
    const allLocations = results
      .filter(Boolean) // Remove null results
      .flatMap(result => result.locations || []);
    
    console.log(`Extracted ${allLocations.length} total locations from ${textItems.length} text items`);
    
    return NextResponse.json({ locations: allLocations });
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
  const textParam = searchParams.get('text');
  
  if (!textParam) {
    return NextResponse.json(
      { error: 'Missing text parameter' },
      { status: 400 }
    );
  }
  
  try {
    // Call the POST handler with our test data
    const mockRequest = new Request('http://localhost', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: textParam })
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