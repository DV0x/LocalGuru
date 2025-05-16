import { NextResponse } from 'next/server';

// Cache for 1 day
const CACHE_TTL = 24 * 60 * 60 * 1000;
const cache = new Map<string, { data: any, timestamp: number }>();

export async function GET(request: Request) {
  try {
    // Get query parameter
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Missing query parameter' },
        { status: 400 }
      );
    }
    
    // Check cache
    if (cache.has(query) && (Date.now() - cache.get(query)!.timestamp) < CACHE_TTL) {
      return NextResponse.json(cache.get(query)!.data);
    }
    
    // Get MAPBOX API key
    const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_API_KEY;
    
    if (!MAPBOX_TOKEN) {
      console.warn('No Mapbox token found, returning dummy data');
      
      // Return dummy data for San Francisco
      const dummyData = {
        longitude: -122.4194,
        latitude: 37.7749,
        address: `${query} (Dummy address - no Mapbox token)`
      };
      
      cache.set(query, { data: dummyData, timestamp: Date.now() });
      return NextResponse.json(dummyData);
    }
    
    // Call Mapbox API
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      
      // Add a very small random jitter to help visualize pins in the same location
      // This is a small offset (max ~5 meters) that helps pins not stack exactly
      const jitterAmount = 0.00005; // ~5 meters
      const longitudeJitter = (Math.random() - 0.5) * jitterAmount;
      const latitudeJitter = (Math.random() - 0.5) * jitterAmount;
      
      const result = {
        longitude: feature.center[0] + longitudeJitter,
        latitude: feature.center[1] + latitudeJitter,
        address: feature.place_name,
        originalCoords: {
          longitude: feature.center[0],
          latitude: feature.center[1]
        }
      };
      
      // Cache the result
      cache.set(query, { data: result, timestamp: Date.now() });
      
      return NextResponse.json(result);
    }
    
    return NextResponse.json(
      { error: 'No locations found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Geocoding error:', error);
    
    return NextResponse.json(
      { error: 'Geocoding failed' },
      { status: 500 }
    );
  }
} 