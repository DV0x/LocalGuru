
# Phase 2: Search Result Visualization - Implementation Plan

## 1. Create Location Extraction Edge Function

```bash
# Navigate to supabase functions directory
cd packages/supabase-functions

# Create new edge function
mkdir extract-locations && cd extract-locations

# Create index.ts file
touch index.ts
```

```typescript
// packages/supabase-functions/extract-locations/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OpenAI } from 'https://esm.sh/openai@4'

serve(async (req) => {
  const { searchResults } = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )
  
  const openai = new OpenAI({
    apiKey: Deno.env.get('OPENAI_API_KEY') || ''
  })
  
  const extractedLocations = []
  
  for (const result of searchResults) {
    // Check cache first
    const { data: cachedLocation } = await supabase
      .from('locations')
      .select('*')
      .eq('source_text', result.snippet)
      .maybeSingle()
      
    if (cachedLocation) {
      extractedLocations.push(cachedLocation)
      continue
    }
    
    // Extract with OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano-2025-04-14',
      messages: [
        {
          role: 'system',
          content: 'Extract business or location names from the following text. Return only an array of location objects.'
        },
        {
          role: 'user',
          content: `Extract all business or location names from this text: "${result.snippet}"\n\nFormat as JSON: {"locations":[{"name":"Business Name","confidence":0.9}]}`
        }
      ],
      response_format: { type: 'json_object' }
    })
    
    try {
      const locations = JSON.parse(response.choices[0].message.content).locations || []
      
      for (const loc of locations) {
        if (loc.confidence >= 0.7) {
          // Check if already in database with different text
          const { data: existingLocation } = await supabase
            .from('locations')
            .select('*')
            .eq('name', loc.name)
            .maybeSingle()
            
          if (existingLocation) {
            extractedLocations.push(existingLocation)
          } else {
            // Geocode the location
            const geocoded = await geocodeLocation(loc.name + ' San Francisco')
            if (geocoded) {
              const newLocation = {
                name: loc.name,
                source_text: result.snippet,
                longitude: geocoded.longitude,
                latitude: geocoded.latitude,
                address: geocoded.address || '',
                confidence: loc.confidence
              }
              
              const { data, error } = await supabase
                .from('locations')
                .insert(newLocation)
                .select()
                .single()
                
              if (!error && data) {
                extractedLocations.push(data)
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Error processing location:', e)
    }
  }
  
  return new Response(
    JSON.stringify({ locations: extractedLocations }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

// Helper function for geocoding
async function geocodeLocation(query: string) {
  const MAPBOX_TOKEN = Deno.env.get('MAPBOX_API_KEY') || ''
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
  
  try {
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0]
      return {
        longitude: feature.center[0],
        latitude: feature.center[1],
        address: feature.place_name
      }
    }
    return null
  } catch (e) {
    console.error('Geocoding error:', e)
    return null
  }
}
```

## 2. Create Locations Database Table

```bash
# Create migration file
cd supabase/migrations
touch $(date +%Y%m%d%H%M%S)_locations.sql
```

```sql
-- supabase/migrations/[timestamp]_locations.sql
create table public.locations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  source_text text not null,
  longitude float not null,
  latitude float not null,
  address text,
  confidence float default 0.8,
  created_at timestamptz default now(),
  unique(name)
);

-- Indexes for performance
create index idx_locations_name on public.locations(name);
create index idx_locations_source_text on public.locations(source_text); 
```

## 3. Create API Route for Location Extraction

```bash
# Create API route file
mkdir -p packages/pwa-app/app/api/extract-locations
touch packages/pwa-app/app/api/extract-locations/route.ts
```

```typescript
// packages/pwa-app/app/api/extract-locations/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

export async function POST(request: Request) {
  try {
    const { searchResults } = await request.json();
    
    // Call the Supabase Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const response = await fetch(
      `${supabaseUrl}/functions/v1/extract-locations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ searchResults })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Edge function error: ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Location extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract locations' },
      { status: 500 }
    );
  }
}
```

## 4. Enhance GeoJSON Utilities

```typescript
// Update packages/pwa-app/app/lib/utils/geojson-utils.ts

// Add function to convert location objects to GeoJSON features
export function locationsToFeatures(locations: any[]): Feature<Point>[] {
  return locations.map(location => ({
    type: 'Feature',
    id: location.id,
    geometry: {
      type: 'Point',
      coordinates: [location.longitude, location.latitude]
    },
    properties: {
      name: location.name,
      address: location.address,
      source: location.source_text,
      confidence: location.confidence
    }
  }));
}

// Add function to create a feature collection from locations
export function locationsToFeatureCollection(locations: any[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: locationsToFeatures(locations)
  };
}
```

## 5. Update Map Context to Handle Location Updates

```typescript
// Update packages/pwa-app/app/contexts/map-context.tsx

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Existing state...
  const [searchResultFeatures, setSearchResultFeatures] = useState<Feature<Point>[]>([]);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  
  // Add function to update features from search results
  const updateFeaturesFromSearchResults = useCallback(async (searchResults: any[]) => {
    if (!searchResults.length) {
      setSearchResultFeatures([]);
      return;
    }
    
    setIsLoadingLocations(true);
    
    try {
      const response = await fetch('/api/extract-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchResults })
      });
      
      if (!response.ok) throw new Error('Failed to extract locations');
      
      const { locations } = await response.json();
      
      if (locations && locations.length) {
        const features = locationsToFeatures(locations);
        setSearchResultFeatures(features);
        
        // Auto-adjust viewport to show all features
        if (features.length && mapRef.current) {
          const bounds = new mapboxgl.LngLatBounds();
          
          features.forEach(feature => {
            if (feature.geometry.type === 'Point') {
              bounds.extend(feature.geometry.coordinates as [number, number]);
            }
          });
          
          mapRef.current.fitBounds(bounds, {
            padding: 50,
            maxZoom: 15,
            duration: 1000
          });
        }
      }
    } catch (error) {
      console.error('Error updating features:', error);
    } finally {
      setIsLoadingLocations(false);
    }
  }, []);
  
  // Return updated context value
  return (
    <MapContext.Provider value={{
      mapRef,
      viewState,
      updateViewState,
      flyToLocation,
      searchResultFeatures,
      setSearchResultFeatures,
      selectedFeatureId,
      setSelectedFeatureId,
      isLoadingLocations,
      updateFeaturesFromSearchResults
    }}>
      {children}
    </MapContext.Provider>
  );
};
```

## 6. Update search/[query]/page.tsx to Process Locations

```typescript
// packages/pwa-app/app/search/[query]/page.tsx

// Add to imports
import { useMapContext } from "@/app/contexts/map-context";

export default function SearchResultsPage() {
  // Existing code...
  const { updateFeaturesFromSearchResults } = useMapContext();
  
  // Add effect to process locations when results change
  useEffect(() => {
    if (results.length > 0) {
      updateFeaturesFromSearchResults(results);
    }
  }, [results, updateFeaturesFromSearchResults]);
  
  // Rest of component...
}
```

## 7. Add Map Loading Indicator

```tsx
// packages/pwa-app/app/components/ui/map-loader.tsx
import { Loader2 } from "lucide-react";

export function MapLoader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading locations...</p>
      </div>
    </div>
  );
}
```

## 8. Update MapPlaceholder Component

```tsx
// packages/pwa-app/app/components/map-placeholder.tsx
"use client";

import dynamic from 'next/dynamic';
import { useMapContext } from '../contexts/map-context';
import { Skeleton } from './ui/skeleton';
import { MapLoader } from './ui/map-loader';
import MapErrorBoundary from './ui/map-error-boundary';

// Dynamic import to prevent SSR issues with mapbox
const InteractiveMap = dynamic(
  () => import('./ui/interactive-map'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-900 rounded-lg">
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    )
  }
);

interface MapPlaceholderProps {
  location?: string;
}

export function MapPlaceholder({ location = 'San Francisco' }: MapPlaceholderProps) {
  const { isLoadingLocations } = useMapContext();
  
  // Default coordinates for supported locations
  const locationCoordinates: Record<string, { longitude: number; latitude: number }> = {
    'San Francisco': { longitude: -122.4194, latitude: 37.7749 },
    // Add other cities as they become available
  };

  const coordinates = locationCoordinates[location] || locationCoordinates['San Francisco'];

  return (
    <div className="w-full h-full rounded-lg overflow-hidden relative">
      <MapErrorBoundary>
        <InteractiveMap initialLocation={coordinates} />
        {isLoadingLocations && <MapLoader />}
      </MapErrorBoundary>
    </div>
  );
} 
```

## 9. Test and Debug the Implementation

1. Deploy Supabase Edge Function
```bash
# Deploy from the supabase directory
supabase functions deploy extract-locations
```

2. Apply migration to create the locations table
```bash
supabase db push
```

3. Update environment variables on your development and production environments
```
MAPBOX_API_KEY=your_mapbox_token
OPENAI_API_KEY=your_openai_token
```

4. Test the complete flow:
   - Enter a search query to get results
   - Verify that locations are extracted and displayed on the map
   - Check that clustering works when multiple points are near each other
   - Verify that clicking on a map pin shows the proper popup
   - Test that the cached locations are reused for subsequent searches

## 10. Optimize and Refine

1. Add debouncing for location processing to prevent excessive API calls

```typescript
// Add to packages/pwa-app/app/lib/utils/index.ts
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
```

2. Update the MapContext to use debouncing

```typescript
// In MapProvider component
const debouncedUpdateFeatures = useCallback(
  debounce((searchResults: any[]) => {
    updateFeaturesFromSearchResults(searchResults);
  }, 300),
  [updateFeaturesFromSearchResults]
);
```

3. Enhance the clustering appearance with distinct colors based on count

```typescript
// Update clusterLayer in interactive-map.tsx
const clusterLayer: CircleLayer = {
  id: 'clusters',
  type: 'circle',
  source: 'search-results',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': [
      'step',
      ['get', 'point_count'],
      '#51bbd6', // Color for point_count < 10
      10,
      '#f1f075', // Color for point_count >= 10 and < 50
      50,
      '#f28cb1' // Color for point_count >= 50
    ],
    'circle-radius': [
      'step',
      ['get', 'point_count'],
      20, // radius for point_count < 10
      10,
      30, // radius for point_count >= 10 and < 50
      50,
      40 // radius for point_count >= 50
    ]
  }
};
```

This detailed plan provides a complete implementation guide for Phase 2 of the map integration, focusing on search result visualization with location extraction, geocoding, and map display.
