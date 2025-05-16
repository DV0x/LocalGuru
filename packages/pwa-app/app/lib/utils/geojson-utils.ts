import type { Feature, FeatureCollection, Point } from 'geojson';
import { LocationData } from '../api/location-client';

export interface GeoLocationData {
  id: string;
  name: string;
  coordinates: [number, number]; // [longitude, latitude]
  properties?: Record<string, any>;
}

export function createGeoJSONFeature(location: GeoLocationData): Feature<Point> {
  return {
    type: 'Feature',
    id: location.id,
    geometry: {
      type: 'Point',
      coordinates: location.coordinates
    },
    properties: {
      name: location.name,
      ...location.properties
    }
  };
}

export function createGeoJSONFeatureCollection(locations: GeoLocationData[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: locations.map(createGeoJSONFeature)
  };
}

/**
 * Convert location objects from the database to GeoJSON features
 * @param locations Array of location objects from the database
 * @returns Array of GeoJSON Feature objects
 */
export function locationsToFeatures(locations: LocationData[]): Feature<Point>[] {
  // Keep track of used coordinates to detect duplicates
  const usedCoordinates = new Map<string, number>();
  
  return locations.map(location => {
    // Create a coordinate key for checking duplicates
    // Round to 5 decimal places (about 1.1 meters precision)
    const roundedLon = Math.round(location.longitude * 100000) / 100000;
    const roundedLat = Math.round(location.latitude * 100000) / 100000;
    const coordKey = `${roundedLon},${roundedLat}`;
    
    // Check if these coordinates were already used
    let lon = location.longitude;
    let lat = location.latitude;
    
    if (usedCoordinates.has(coordKey)) {
      // Increment count of pins at this location
      const count = usedCoordinates.get(coordKey)! + 1;
      usedCoordinates.set(coordKey, count);
      
      // Add small offset in a spiral pattern to make overlapping pins visible
      // This creates a small spiral of pins around the actual location
      const angle = count * (Math.PI / 4); // 45 degree increments
      const radius = 0.0003 * count; // About 30 meters per step
      
      lon += radius * Math.cos(angle);
      lat += radius * Math.sin(angle);
      
      console.log(`Applied offset to duplicate location: ${location.name} (${count} at ${coordKey})`);
    } else {
      // First time seeing these coordinates
      usedCoordinates.set(coordKey, 1);
    }
    
    return {
      type: 'Feature',
      id: location.id,
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      },
      properties: {
        name: location.name,
        address: location.address,
        source: location.source_text,
        confidence: location.confidence,
        created_at: location.created_at,
        // Add a flag to indicate if this pin was offset
        isOffset: lon !== location.longitude
      }
    };
  });
}

/**
 * Create a GeoJSON FeatureCollection from location objects
 * @param locations Array of location objects from the database
 * @returns GeoJSON FeatureCollection
 */
export function locationsToFeatureCollection(locations: LocationData[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: locationsToFeatures(locations)
  };
}

/**
 * Extract locations from search results using the API
 * @param searchResults Array of search results
 * @returns Promise that resolves to an array of GeoJSON Feature objects
 */
export async function extractLocationsFromSearchResults(searchResults: any[]): Promise<Feature<Point>[]> {
  if (!searchResults || searchResults.length === 0) {
    return [];
  }
  
  try {
    // Call the API endpoint
    const response = await fetch('/api/extract-locations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ searchResults }),
    });

    if (!response.ok) {
      throw new Error(`Failed to extract locations: ${response.status}`);
    }

    const { locations } = await response.json();
    
    if (!locations || !Array.isArray(locations)) {
      return [];
    }

    // Convert the locations to GeoJSON features
    return locationsToFeatures(locations);
  } catch (error) {
    console.error('Error extracting locations:', error);
    return [];
  }
}