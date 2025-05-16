import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Cache for OpenAI responses
const cache = new Map<string, any>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hour cache

export async function POST(request: Request) {
  try {
    const { snippets } = await request.json();
    
    // Generate cache key from snippet text
    const cacheKey = snippets.slice(0, 100); // Use first 100 chars as a simple cache key
    
    // Check cache first
    if (cache.has(cacheKey)) {
      console.log('Using cached location extraction results');
      const { timestamp, result } = cache.get(cacheKey);
      
      // Cache still valid?
      if (Date.now() - timestamp < CACHE_TTL) {
        return NextResponse.json(result);
      }
      
      // Cache expired
      cache.delete(cacheKey);
    }
    
    console.log('Extracting locations from snippets using OpenAI');
    
    // Call OpenAI to extract location names
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting location names from text. 
For each snippet indexed with [X], identify restaurant and business names or specific attractions that would be useful to show on a map. 
Do not include general areas like neighborhoods, cities, or street names unless they are the main subject.
For each location, include the snippet index it was found in, and a confidence score (0-1).
Return ONLY valid JSON with this format:
{
  "locations": [
    {"name": "Specific Location Name", "snippetIndex": 0, "confidence": 0.9},
    ...
  ]
}`
        },
        {
          role: "user",
          content: snippets
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    
    // Parse and return the result
    const output = JSON.parse(response.choices[0].message.content || '{"locations":[]}');
    
    // Store in cache
    cache.set(cacheKey, {
      timestamp: Date.now(),
      result: output
    });
    
    // Return debug info along with the locations for troubleshooting
    const result = {
      ...output,
      debug: {
        inputLength: snippets.length,
        snippetCount: (snippets.match(/\[\d+\]/g) || []).length,
        extractedCount: output.locations?.length || 0,
        processingTime: response.usage?.total_tokens || 0,
        sampleSnippets: snippets.slice(0, 200) + (snippets.length > 200 ? '...' : ''),
      }
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error extracting locations:', error);
    return NextResponse.json(
      { error: 'Failed to extract locations', details: (error as Error).message },
      { status: 500 }
    );
  }
} 