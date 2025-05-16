import { SearchResult } from '../types/search';
import { v4 as uuidv4 } from 'uuid';

// Define the location data structure matching the expected format
export interface ExtractedLocation {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  address: string;
  confidence: number;
  source_text: string;
  created_at: string;
}

// In-memory cache for extracted locations
const locationsCache = new Map<string, ExtractedLocation[]>();

/**
 * Extract locations from search results using direct API calls
 * @param searchResults Array of search results to extract locations from
 */
export async function extractLocationsFromSearchResults(
  searchResults: SearchResult[]
): Promise<ExtractedLocation[]> {
  if (!searchResults || searchResults.length === 0) {
    return [];
  }

  // Generate a cache key from the results
  const cacheKey = generateCacheKey(searchResults);
  
  // Check cache first
  if (locationsCache.has(cacheKey)) {
    console.log(`Using cached locations for batch: ${cacheKey}`);
    return locationsCache.get(cacheKey) || [];
  }
  
  console.log(`Extracting locations from ${searchResults.length} results (batch key: ${cacheKey})`);
  
  try {
    // Step 1: Extract location names using Next.js API route (which will proxy to OpenAI)
    const locationNames = await extractLocationNames(searchResults);
    
    // Step 2: Geocode locations in parallel batches
    const geocodedLocations = await geocodeLocations(locationNames, searchResults);
    
    // Store in cache
    locationsCache.set(cacheKey, geocodedLocations);
    
    return geocodedLocations;
  } catch (error) {
    console.error('Error extracting locations:', error);
    return [];
  }
}

/**
 * Extract location names from search results using batch processing
 */
async function extractLocationNames(searchResults: SearchResult[]): Promise<{name: string, confidence: number, snippetIndex: number}[]> {
  try {
    // Create a combined prompt with all search snippets
    const snippetsText = searchResults
      .map((result, index) => `[${index}] "${result.snippet}"`)
      .join('\n\n');
    
    // Call the API route that will proxy to OpenAI
    const response = await fetch('/api/extract-location-names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippets: snippetsText }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to extract location names: ${response.status}`);
    }
    
    const { locations } = await response.json();
    
    // Map the response to include the source snippet index
    return locations.map((loc: any) => ({
      name: loc.name,
      confidence: loc.confidence,
      snippetIndex: loc.snippetIndex
    }));
  } catch (error) {
    console.error('Error extracting location names:', error);
    return [];
  }
}

/**
 * Geocode location names in parallel batches
 */
async function geocodeLocations(
  locationNames: {name: string, confidence: number, snippetIndex: number}[],
  searchResults: SearchResult[]
): Promise<ExtractedLocation[]> {
  if (!locationNames.length) return [];
  
  // Process geocoding in batches of 10 to avoid rate limits
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < locationNames.length; i += batchSize) {
    batches.push(locationNames.slice(i, i + batchSize));
  }
  
  // Process each batch and flatten results
  const extractedLocations: ExtractedLocation[] = [];
  
  for (const batch of batches) {
    // Process this batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (location) => {
        // Get source snippet for this location
        const sourceText = searchResults[location.snippetIndex]?.snippet || '';
        
        // Call MapBox geocoding API through our proxy
        try {
          const geocoded = await geocodeLocation(location.name);
          
          if (geocoded) {
            return {
              id: uuidv4(), // Generate a UUID for the location
              name: location.name,
              longitude: geocoded.longitude,
              latitude: geocoded.latitude,
              address: geocoded.address,
              confidence: location.confidence,
              source_text: sourceText,
              created_at: new Date().toISOString() // Add current timestamp
            };
          }
        } catch (e) {
          console.error(`Failed to geocode "${location.name}":`, e);
        }
        
        return null;
      })
    );
    
    // Add valid results to the final array
    extractedLocations.push(...batchResults.filter(Boolean) as ExtractedLocation[]);
  }
  
  return extractedLocations;
}

/**
 * Geocode a single location name using our proxy API
 */
async function geocodeLocation(locationName: string): Promise<{longitude: number, latitude: number, address: string} | null> {
  try {
    // Append the default city to improve geocoding accuracy
    const query = `${locationName} San Francisco`;
    
    console.log(`Geocoding: "${locationName}"`);
    
    // Call our proxy API to geocode the location
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`Geocoded "${locationName}" to [${result.longitude}, ${result.latitude}]`);
    
    return result;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Generate a cache key from a list of search results
 */
function generateCacheKey(searchResults: SearchResult[]): string {
  if (!searchResults || !searchResults.length) return '';
  
  const firstId = searchResults[0]?.id || '';
  const lastId = searchResults[searchResults.length - 1]?.id || '';
  return `${firstId.substring(0, 7)}-${lastId.substring(0, 7)}-${searchResults.length}`;
} 