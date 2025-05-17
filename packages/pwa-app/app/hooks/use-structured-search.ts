"use client";

import { useState, useEffect, useRef } from 'react';
import { PerplexityStructuredClient, PerplexityStructuredResponse } from '../lib/api/perplexity-structured-client';
import { FarcasterClient } from '../lib/api/farcaster-client';
import { SearchStatus, SearchResult } from '../lib/types/search';
import { LocationData } from '../lib/api/location-client';
import { useMapContext } from '../contexts/map-context';
import { useAuth } from '../contexts/auth-context';
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
  
  const [farcasterResults, setFarcasterResults] = useState<any[]>([]);
  const [farcasterLocations, setFarcasterLocations] = useState<LocationData[]>([]);
  const [isFarcasterLoading, setIsFarcasterLoading] = useState(false);
  const [activeResultsTab, setActiveResultsTab] = useState<'structured' | 'social'>('structured');
  
  const perplexityClientRef = useRef(new PerplexityStructuredClient());
  const farcasterClientRef = useRef(new FarcasterClient());
  
  const { user } = useAuth();
  
  const mapContext = useMapContext();
  
  const createSearchResultsFromSources = (sources: any[]) => {
    return sources.map((source, index) => ({
      id: `source-${index}`,
      title: source.title || 'Source',
      snippet: '',
      url: source.url || '',
      source: source.url ? new URL(source.url).hostname : 'Unknown'
    }));
  };
  
  const processStructuredResponse = (response: PerplexityStructuredResponse) => {
    try {
      if (!response) {
        console.error('Empty Perplexity response received');
        setError('Empty response received');
        return;
      }
      
      console.log('Processing Perplexity structured response:', response);
      
      setStructuredResponse(response);
      
      setContent(response.summary);
      
      const locationData = perplexityClientRef.current.convertToLocationData(response);
      setLocations(locationData);
      
      if (response.locations && response.locations.length > 0) {
        console.log(`Processing ${response.locations.length} Perplexity locations`);
        
        if (response.locations[0]) {
          console.log('Sample location with coordinates:', response.locations[0]);
        }
        
        if (activeResultsTab === 'structured') {
          const features = perplexityLocationsToFeatures(response.locations);
          
          if (features.length > 0) {
            console.log(`Created ${features.length} map features from Perplexity data`);
            
            mapContext.setSearchResultFeatures(features);
            
            setTimeout(() => {
              mapContext.fitBoundsToFeatures();
            }, 500);
          } else {
            console.warn('No valid features could be created from Perplexity locations');
            setError('Could not extract location information from the response');
          }
        }
      } else {
        console.warn('No locations found in Perplexity response');
        setError('No locations found in the search results');
      }
      
      if (response.sources && response.sources.length > 0) {
        const searchResults = createSearchResultsFromSources(response.sources);
        setResults(searchResults);
      }
    } catch (err) {
      console.error('Error processing Perplexity response:', err);
      setError('Error processing search results: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };
  
  const geocodeLocationsIfNeeded = async (response: PerplexityStructuredResponse) => {
    const locationsNeedingGeocoding = response.locations.filter(
      loc => !loc.coordinates || !loc.coordinates.latitude || !loc.coordinates.longitude
    );
    
    if (locationsNeedingGeocoding.length > 0) {
      console.log(`${locationsNeedingGeocoding.length} locations need geocoding`);
      
      for (const location of locationsNeedingGeocoding) {
        try {
          const response = await fetch('/api/geocode', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              location: `${location.name}, ${location.address}` 
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.coordinates) {
              location.coordinates = {
                latitude: data.coordinates.latitude,
                longitude: data.coordinates.longitude
              };
              console.log(`Geocoded ${location.name} to`, location.coordinates);
            }
          }
        } catch (error) {
          console.error(`Error geocoding ${location.name}:`, error);
        }
      }
    }
  };
  
  const processFarcasterLocations = async (casts: any[]) => {
    try {
      if (!casts || casts.length === 0) {
        console.warn('No Farcaster casts to process');
        return;
      }
      
      console.log(`Processing ${casts.length} Farcaster casts`);
      
      const extractedLocations = await farcasterClientRef.current.extractLocationsFromCasts(casts);
      
      setFarcasterLocations(extractedLocations);
      
      if (activeResultsTab === 'social' && extractedLocations.length > 0) {
        const features = locationsToFeatures(extractedLocations);
        
        if (features.length > 0) {
          console.log(`Created ${features.length} map features from Farcaster data`);
          
          mapContext.setSearchResultFeatures(features);
          
          setTimeout(() => {
            mapContext.fitBoundsToFeatures();
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error processing Farcaster locations:', error);
    }
  };
  
  const search = async (searchQuery: string, location?: string) => {
    try {
      setQuery(searchQuery);
      setStatus('searching');
      setResults([]);
      setContent('');
      setLocations([]);
      setError(null);
      setStructuredResponse(null);
      setIsLoading(true);
      
      mapContext.setSearchResultFeatures([]);
      
      console.log(`Search location received in hook: "${location || 'undefined'}"`);
      
      const response = await perplexityClientRef.current.searchWithStructuredOutput(searchQuery, { 
        location: location || 'San Francisco'
      });
      
      processStructuredResponse(response);
      
      await geocodeLocationsIfNeeded(response);
      
      setStatus('complete');
      
    } catch (err) {
      console.error('Structured search error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  const enhancedSearch = async (searchQuery: string, location?: string) => {
    try {
      setQuery(searchQuery);
      setStatus('searching');
      setResults([]);
      setContent('');
      setLocations([]);
      setFarcasterResults([]);
      setFarcasterLocations([]);
      setError(null);
      setStructuredResponse(null);
      setIsLoading(true);
      setIsFarcasterLoading(true);
      
      mapContext.setSearchResultFeatures([]);
      
      const locationToUse = location || 'San Francisco';
      
      console.log(`Enhanced search for "${searchQuery}" in location: "${locationToUse}"`);
      
      const perplexityPromise = perplexityClientRef.current.searchWithStructuredOutput(
        searchQuery,
        { location: locationToUse }
      );
      
      const farcasterPromise = farcasterClientRef.current.combinedLocationSearch(
        searchQuery,
        locationToUse,
        {
          timeframe: '3m',
          limit: 10,
          viewerFid: user?.fid
        }
      );
      
      const [perplexityResponse, farcasterResponse] = await Promise.all([
        perplexityPromise.catch(error => {
          console.error('Perplexity search error:', error);
          return null;
        }),
        farcasterPromise.catch(error => {
          console.error('Farcaster search error:', error);
          return { casts: [] };
        })
      ]);
      
      if (perplexityResponse) {
        processStructuredResponse(perplexityResponse);
        
        await geocodeLocationsIfNeeded(perplexityResponse);
      } else {
        setError('Failed to get structured search results');
      }
      
      setFarcasterResults(farcasterResponse.casts);
      
      if (farcasterResponse.casts && farcasterResponse.casts.length > 0) {
        await processFarcasterLocations(farcasterResponse.casts);
      }
      
      setStatus('complete');
    } catch (error) {
      console.error('Enhanced search error:', error);
      setStatus('error');
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
      setIsFarcasterLoading(false);
    }
  };
  
  const toggleResultsTab = (tab: 'structured' | 'social') => {
    setActiveResultsTab(tab);
    
    if (tab === 'structured' && structuredResponse) {
      const features = perplexityLocationsToFeatures(structuredResponse.locations);
      mapContext.setSearchResultFeatures(features);
    } else if (tab === 'social' && farcasterLocations.length > 0) {
      const features = locationsToFeatures(farcasterLocations);
      mapContext.setSearchResultFeatures(features);
    }
    
    setTimeout(() => {
      mapContext.fitBoundsToFeatures();
    }, 500);
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
    isLoading,
    farcasterResults,
    farcasterLocations,
    isFarcasterLoading,
    enhancedSearch,
    activeResultsTab,
    toggleResultsTab
  };
} 