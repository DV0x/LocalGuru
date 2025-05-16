// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore
import { OpenAI } from 'https://esm.sh/openai@4'

interface SearchResult {
  snippet: string;
  [key: string]: any;
}

interface LocationData {
  name: string;
  confidence: number;
}

interface GeocodedLocation {
  longitude: number;
  latitude: number;
  address: string;
}

serve(async (req: Request) => {
  const { searchResults } = await req.json() as { searchResults: SearchResult[] }
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
      const locations = JSON.parse(response.choices[0].message.content).locations as LocationData[] || []
      
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
            const geocoded = await geocodeLocation(`${loc.name} San Francisco`)
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
async function geocodeLocation(query: string): Promise<GeocodedLocation | null> {
  const MAPBOX_TOKEN = Deno.env.get('MAPBOX_API_KEY') || ''
  
  // If no Mapbox token, return dummy data for testing
  if (!MAPBOX_TOKEN) {
    console.warn('No Mapbox token found, returning dummy geocoding data')
    return {
      longitude: -122.4194,
      latitude: 37.7749,
      address: `${query} (Dummy address - no Mapbox token)`
    }
  }
  
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