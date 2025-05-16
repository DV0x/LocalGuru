"use client";

import { useState, useEffect, useRef } from 'react';
import { PerplexityStructuredClient, PerplexityStructuredResponse } from '../lib/api/perplexity-structured-client';
import { SearchStatus, SearchResult } from '../lib/types/search';
import { LocationData } from '../lib/api/location-client';
import { useMapContext } from '../contexts/map-context';
import { locationsToFeatures, perplexityLocationsToFeatures } from '../lib/utils/geojson-utils';

export function useStructuredSearch() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [structuredResponse, setStructuredResponse] = useState<PerplexityStructuredResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const clientRef = useRef(new PerplexityStructuredClient());
  
  // Get map context for updating features
  const mapContext = useMapContext();
  
  // Function to generate search results from sources
  const createSearchResultsFromSources = (sources: any[]) => {
    return sources.map((source, index) => ({
      id: `source-${index}`,
      title: source.title || 'Source',
      snippet: '',
      url: source.url || '',
      source: source.url ? new URL(source.url).hostname : 'Unknown'
    }));
  };
  
  // Process structured response and update map
  const processStructuredResponse = (response: PerplexityStructuredResponse) => {
    try {
      // Validate the response
      if (!response) {
        console.error('Empty Perplexity response received');
        setError('Empty response received');
        return;
      }
      
      console.log('Processing Perplexity structured response:', response);
      
      // Store the full structured response
      setStructuredResponse(response);
      
      // Set the summary as content
      setContent(response.summary);
      
      // Convert locations to our app's format
      const locationData = clientRef.current.convertToLocationData(response);
      setLocations(locationData);
      
      // Update map with locations directly from Perplexity data
      // Use our new utility function to convert directly to GeoJSON features
      if (response.locations && response.locations.length > 0) {
        console.log(`Processing ${response.locations.length} Perplexity locations`);
        
        // Log some sample location data to verify structure
        if (response.locations[0]) {
          console.log('Sample location with coordinates:', response.locations[0]);
        }
        
        // Direct conversion from Perplexity locations to GeoJSON features
        const features = perplexityLocationsToFeatures(response.locations);
        
        if (features.length > 0) {
          console.log(`Created ${features.length} map features from Perplexity data`);
          
          // Update map context with the new features
          mapContext.setSearchResultFeatures(features);
          
          // Fit map to show all locations
          setTimeout(() => {
            mapContext.fitBoundsToFeatures();
          }, 500);
        } else {
          console.warn('No valid features could be created from Perplexity locations');
          setError('Could not extract location information from the response');
        }
      } else {
        console.warn('No locations found in Perplexity response');
        setError('No locations found in the search results');
      }
      
      // Create search results from sources
      if (response.sources && response.sources.length > 0) {
        const searchResults = createSearchResultsFromSources(response.sources);
        setResults(searchResults);
      }
    } catch (err) {
      console.error('Error processing Perplexity response:', err);
      setError('Error processing search results: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };
  
  // For locations that need geocoding
  const geocodeLocationsIfNeeded = async (response: PerplexityStructuredResponse) => {
    // Look for locations that need geocoding
    const locationsNeedingGeocoding = response.locations.filter(
      loc => !loc.coordinates || !loc.coordinates.latitude || !loc.coordinates.longitude
    );
    
    if (locationsNeedingGeocoding.length > 0) {
      console.log(`${locationsNeedingGeocoding.length} locations need geocoding`);
      
      // We could implement geocoding here, but for now we'll just log
      // In a real implementation, we would call our geocoding API
    }
  };
  
  // Main search function
  const search = async (searchQuery: string, location?: string) => {
    try {
      // Reset state
      setQuery(searchQuery);
      setStatus('searching');
      setResults([]);
      setContent('');
      setLocations([]);
      setError(null);
      setStructuredResponse(null);
      setIsLoading(true);
      
      // Clear map features
      mapContext.setSearchResultFeatures([]);
      
      console.log(`Starting structured search: ${searchQuery} in ${location || 'San Francisco'}`);
      
      // Perform the structured search
      const response = await clientRef.current.searchWithStructuredOutput(searchQuery, { 
        location: location || 'San Francisco'
      });
      
      // Process the response
      processStructuredResponse(response);
      
      // Try to geocode any locations without coordinates
      await geocodeLocationsIfNeeded(response);
      
      // Update status
      setStatus('complete');
      
    } catch (err) {
      console.error('Structured search error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    query,
    status,
    results,
    content,
    error,
    locations,
    structuredResponse,
    search,
    isLoading
  };
} 