import { NextResponse } from 'next/server';

// Simple in-memory cache with a 24-hour expiration
const geocodeCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(request: Request) {
  try {
    const { location, address } = await request.json();
    
    // Validate input
    const locationText = location || address;
    if (!locationText) {
      return NextResponse.json(
        { error: 'Missing location or address parameter' },
        { status: 400 }
      );
    }
    
    // Check cache
    const cacheKey = locationText.toLowerCase().trim();
    const cachedData = geocodeCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
      console.log(`Using cached geocode for: ${locationText}`);
      return NextResponse.json(cachedData.data);
    }
    
    // Call Mapbox Geocoding API
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!mapboxToken) {
      throw new Error('Mapbox token not configured');
    }
    
    console.log(`Geocoding location: ${locationText}`);
    
    const encodedLocation = encodeURIComponent(locationText);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${mapboxToken}&limit=1`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Geocoding error (${response.status}):`, errorText);
      throw new Error(`Geocoding API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Process the result
    const result: {
      query: string;
      coordinates: { longitude: number; latitude: number } | null;
      address: string | null;
      place_name: string | null;
    } = {
      query: locationText,
      coordinates: null,
      address: null,
      place_name: null
    };
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      
      result.coordinates = {
        longitude: feature.center[0],
        latitude: feature.center[1]
      };
      
      result.place_name = feature.place_name;
      
      // Attempt to extract a formatted address
      const addressComponents = {
        street: feature.text || '',
        city: '',
        state: '',
        country: ''
      };
      
      // Parse context for additional address info
      if (feature.context) {
        feature.context.forEach((ctx: any) => {
          if (ctx.id.startsWith('place')) {
            addressComponents.city = ctx.text;
          } else if (ctx.id.startsWith('region')) {
            addressComponents.state = ctx.text;
          } else if (ctx.id.startsWith('country')) {
            addressComponents.country = ctx.text;
          }
        });
      }
      
      // Format address string
      const addressParts = [];
      if (addressComponents.street) addressParts.push(addressComponents.street);
      if (addressComponents.city) addressParts.push(addressComponents.city);
      if (addressComponents.state) addressParts.push(addressComponents.state);
      if (addressComponents.country) addressParts.push(addressComponents.country);
      
      result.address = addressParts.join(', ');
    }
    
    // Cache the result
    geocodeCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Geocoding API error:', error);
    
    return NextResponse.json(
      { error: 'Failed to geocode location', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// For testing via GET
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get('location');
  
  if (!location) {
    return NextResponse.json(
      { error: 'Missing location parameter' },
      { status: 400 }
    );
  }
  
  try {
    const mockRequest = new Request('http://localhost', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ location })
    });
    
    return await POST(mockRequest);
  } catch (error) {
    console.error('GET geocode error:', error);
    
    return NextResponse.json(
      { error: 'Failed to process geocode request' },
      { status: 500 }
    );
  }
} 