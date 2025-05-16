import { v4 as uuidv4 } from 'uuid';
import { LocationData } from './location-client';

// Define interface for extracted locations
export interface PerplexityLocation {
  id: string;
  name: string;
  address: string;
  description: string;
}

/**
 * Extract locations from Perplexity generated content
 * using the [LOCATION: Name, Address, Description] format
 */
export function extractLocationsFromContent(content: string): PerplexityLocation[] {
  if (!content) return [];
  
  const locationPattern = /\[LOCATION: ([^,]+), ([^,]+(?:, [^,]+)*), ([^\]]+)\]/g;
  const extractedLocations: PerplexityLocation[] = [];
  let match;
  
  while ((match = locationPattern.exec(content)) !== null) {
    extractedLocations.push({
      id: uuidv4(),
      name: match[1].trim(),
      address: match[2].trim(),
      description: match[3].trim()
    });
  }
  
  return extractedLocations;
}

/**
 * Geocode extracted locations using our existing geocoding API
 */
export async function geocodeLocations(
  locations: PerplexityLocation[]
): Promise<LocationData[]> {
  if (!locations || !locations.length) return [];
  
  // Process geocoding in batches of 5 to avoid rate limits
  const batchSize = 5;
  const batches = [];
  
  for (let i = 0; i < locations.length; i += batchSize) {
    batches.push(locations.slice(i, i + batchSize));
  }
  
  // Process each batch and flatten results
  const geocodedLocations: LocationData[] = [];
  
  for (const batch of batches) {
    // Process this batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (location) => {
        try {
          // Call our geocoding API
          const geocoded = await geocodeLocation(location.name, location.address);
          
          if (geocoded) {
            return {
              id: location.id,
              name: location.name,
              longitude: geocoded.longitude,
              latitude: geocoded.latitude,
              address: location.address,
              confidence: 0.9, // High confidence since we have specific addresses
              source_text: location.description, // Use the description as source_text
              created_at: new Date().toISOString()
            };
          }
        } catch (e) {
          console.error(`Failed to geocode "${location.name}":`, e);
        }
        
        return null;
      })
    );
    
    // Add valid results to the final array
    geocodedLocations.push(...batchResults.filter(Boolean) as LocationData[]);
  }
  
  return geocodedLocations;
}

/**
 * Geocode a single location using our existing geocoding API
 */
async function geocodeLocation(
  locationName: string, 
  address: string
): Promise<{longitude: number, latitude: number} | null> {
  try {
    // Use both name and address for better geocoding results
    const query = `${locationName}, ${address}`;
    
    console.log(`Geocoding: "${query}"`);
    
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