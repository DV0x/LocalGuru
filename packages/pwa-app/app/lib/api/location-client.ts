import { SearchResult } from '../types/search';
import { API_ROUTES } from './config';

export interface LocationData {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  address: string;
  confidence: number;
  source_text: string;
  created_at: string;
  // Optional properties for enhanced location data
  price_level?: string | number;
  rating?: number;
  category?: string;
  hours?: string;
  highlights?: string[];
}

export class LocationClient {
  /**
   * Extract locations from search results
   * @param searchResults Array of search results to extract locations from
   * @returns Promise with the extracted locations
   */
  static async extractLocations(searchResults: SearchResult[]): Promise<LocationData[]> {
    try {
      // Log the API call for debugging
      console.log(`Extracting locations from ${searchResults.length} results`);
      
      // Call the API route
      const response = await fetch('/api/extract-locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchResults }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Location extraction error (${response.status}):`, errorText);
        throw new Error(`Failed to extract locations: ${response.status}`);
      }

      const { locations } = await response.json();
      
      console.log(`Extracted ${locations?.length || 0} locations`);
      
      return locations || [];
    } catch (error) {
      console.error('Location extraction client error:', error);
      return [];
    }
  }

  /**
   * Get locations near a specific point
   * @param latitude Latitude of the point
   * @param longitude Longitude of the point
   * @param distanceMeters Maximum distance in meters (default: 5000)
   * @returns Promise with the nearby locations
   */
  static async getNearbyLocations(
    latitude: number, 
    longitude: number, 
    distanceMeters: number = 5000
  ): Promise<LocationData[]> {
    try {
      const { data, error } = await fetch('/api/locations/nearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          latitude, 
          longitude, 
          distance_meters: distanceMeters 
        }),
      }).then(res => res.json());

      if (error) {
        console.error('Nearby locations error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Nearby locations client error:', error);
      return [];
    }
  }
} 