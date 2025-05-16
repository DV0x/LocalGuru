'use client'

import React, { createContext, useState, useContext, useRef, useCallback, useEffect } from 'react';
import type { MapRef } from 'react-map-gl/mapbox';
import type { Feature, Point } from 'geojson';
import { locationsToFeatures } from '../lib/utils/geojson-utils';
import { debounce } from '../lib/utils';
import { extractLocationsFromSearchResults } from '../lib/api/location-extraction';

interface MapContextType {
  mapRef: React.RefObject<MapRef>;
  viewState: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  updateViewState: (newViewState: Partial<MapContextType['viewState']>) => void;
  flyToLocation: (longitude: number, latitude: number, zoom?: number) => void;
  // Features and locations
  searchResultFeatures: Feature<Point>[];
  setSearchResultFeatures: React.Dispatch<React.SetStateAction<Feature<Point>[]>>;
  selectedFeatureId: string | null;
  setSelectedFeatureId: React.Dispatch<React.SetStateAction<string | null>>;
  // Location update functions - changed to handle debouncing
  updateFeaturesFromSearchResults: (searchResults: any[]) => void;
  isLoadingLocations: boolean;
  // Fit bounds to show all features
  fitBoundsToFeatures: () => void;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState({
    longitude: -122.4194, // San Francisco default
    latitude: 37.7749,
    zoom: 12
  });
  const [searchResultFeatures, setSearchResultFeatures] = useState<Feature<Point>[]>([]);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [lastProcessedBatch, setLastProcessedBatch] = useState<string>('');

  const updateViewState = useCallback((newViewState: Partial<MapContextType['viewState']>) => {
    setViewState(current => ({ ...current, ...newViewState }));
  }, []);

  const flyToLocation = useCallback((longitude: number, latitude: number, zoom = 14) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [longitude, latitude],
        zoom,
        duration: 1000
      });
    }
  }, []);

  // Create a function to fit the map bounds to show all features
  const fitBoundsToFeatures = useCallback(() => {
    if (!mapRef.current || searchResultFeatures.length === 0) return;

    try {
      // Get mapboxgl from the map ref
      const mapboxgl = (mapRef.current as any).getMap().mapboxgl;
      
      // Create a bounds object
      const bounds = new mapboxgl.LngLatBounds();
      
      // Extend the bounds to include each feature
      searchResultFeatures.forEach(feature => {
        if (feature.geometry.type === 'Point') {
          bounds.extend(feature.geometry.coordinates as [number, number]);
        }
      });
      
      // If we have valid bounds, fit the map to them
      if (!bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15,
          duration: 1000
        });
      }
    } catch (error) {
      console.error('Error fitting bounds:', error);
    }
  }, [searchResultFeatures]);

  // Improved debounced update function with direct API calls
  const debouncedUpdateFeatures = useCallback(
    debounce((searchResults: any[]) => {
      // Skip empty results
      if (!searchResults || !searchResults.length) {
        setSearchResultFeatures([]);
        return;
      }
      
      // Create a simple hash of the results array to check for duplicates
      const firstId = searchResults[0]?.id || '';
      const lastId = searchResults[searchResults.length - 1]?.id || '';
      const batchId = `${firstId}-${lastId}-${searchResults.length}`;
      
      // Skip if same batch was already processed
      if (batchId === lastProcessedBatch) {
        console.log(`Skipping already processed batch: ${batchId}`);
        return;
      }
      
      // Update the last processed batch ID
      setLastProcessedBatch(batchId);
      console.log(`Processing location extraction (debounced) for batch: ${batchId}`);
      
      // Set loading state
      setIsLoadingLocations(true);
      
      // Use the new direct API approach
      extractLocationsFromSearchResults(searchResults)
        .then(locations => {
          if (locations && locations.length > 0) {
            console.log(`Extracted ${locations.length} locations from search results`);
            // Convert locations to GeoJSON features
            const features = locationsToFeatures(locations);
            
            // Log the features to help debug
            console.log(`Generated ${features.length} map features`);
            if (features.length < locations.length) {
              console.warn('Some locations could not be converted to features');
            }
            
            setSearchResultFeatures(features);
            
            // Auto-fit bounds after a short delay to ensure the map is ready
            setTimeout(() => {
              fitBoundsToFeatures();
            }, 500);
          } else {
            console.log('No locations extracted from search results');
            setSearchResultFeatures([]);
          }
        })
        .catch(error => {
          console.error('Error extracting locations:', error);
          setSearchResultFeatures([]);
        })
        .finally(() => {
          setIsLoadingLocations(false);
        });
    }, 800), // Increased debounce timeout to 800ms
    [fitBoundsToFeatures, lastProcessedBatch]
  );

  // When features change, update selected feature if it no longer exists
  useEffect(() => {
    if (selectedFeatureId && searchResultFeatures.length > 0) {
      const featureExists = searchResultFeatures.some(feature => feature.id === selectedFeatureId);
      if (!featureExists) {
        setSelectedFeatureId(null);
      }
    } else if (searchResultFeatures.length === 0) {
      setSelectedFeatureId(null);
    }
  }, [searchResultFeatures, selectedFeatureId]);

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
      updateFeaturesFromSearchResults: debouncedUpdateFeatures,
      isLoadingLocations,
      fitBoundsToFeatures
    }}>
      {children}
    </MapContext.Provider>
  );
};

export const useMapContext = (): MapContextType => {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
}; 