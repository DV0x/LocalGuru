"use client";

import { useState } from 'react';
import { SearchBar } from '../components/search-bar';
import { DraggableContentOverlay } from '../components/draggable-content-overlay';
import { MapPlaceholder } from '../components/map-placeholder';
import { MapProvider, useMapContext } from '../contexts/map-context';
import { useStructuredSearch } from '../hooks/use-structured-search';
import { LocationCardList } from '../components/location-card-list';
import { useRef } from 'react';

// Separate component that uses the MapContext
function StructuredDemoContent() {
  // Get ref for draggable content overlay
  const overlayRef = useRef<React.ElementRef<typeof DraggableContentOverlay>>(null);
  
  // Use the structured search hook
  const {
    query,
    status,
    results,
    content,
    error,
    locations,
    structuredResponse,
    search,
    isLoading
  } = useStructuredSearch();
  
  // Selected location for details
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  
  // Track the currently selected city
  const [currentCity, setCurrentCity] = useState<string>("San Francisco");
  
  // Get map context for interactions
  const mapContext = useMapContext();
  
  // Handle search submission
  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      console.log(`Searching for "${searchQuery}" in location: "${currentCity}"`);
      search(searchQuery, currentCity);
    }
  };
  
  // Handle location change
  const handleLocationChange = (location: string) => {
    console.log(`Location changed to: "${location}"`);
    
    // Update the current location state
    setCurrentCity(location);
    
    // If we have an active search, re-run it with the new location
    if (query && query.trim()) {
      console.log(`Re-running search for "${query}" with location: "${location}"`);
      search(query, location);
    } else {
      console.log('No active query to search with the new location');
    }
  };
  
  // Handle selecting a location from the list
  const handleLocationSelect = (location: any, index: number) => {
    console.log(`Selected location: ${location.name}`);
    setSelectedLocation(location);
    
    // If this location has coordinates, fly to it on the map
    if (location.coordinates?.latitude && location.coordinates?.longitude) {
      // Set the feature ID to highlight the pin
      mapContext.setSelectedFeatureId(`perplexity-${index}`);
      
      // Fly to the location
      mapContext.flyToLocation(
        location.coordinates.longitude,
        location.coordinates.latitude,
        15 // Zoom level
      );
    }
  };
  
  return (
    <div className="relative flex flex-col h-screen bg-background">
      {/* Search Header */}
      <header className="absolute top-0 left-0 right-0 z-40 p-4">
        <div className="text-center mb-2">
          <div className="text-sm font-medium text-primary">
            Structured JSON Search Demo
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Try searching in different cities by changing the location!
          </div>
        </div>
        <SearchBar 
          onSearch={handleSearch} 
          initialValue={query}
          isLoading={isLoading}
          onLocationChange={handleLocationChange}
        />
      </header>
      
      {/* Map (Full Screen) */}
      <div className="flex-grow w-full h-full">
        <MapPlaceholder />
      </div>
      
      {/* Draggable Content Overlay */}
      <DraggableContentOverlay
        ref={overlayRef}
        content={content}
        results={results}
        isLoading={isLoading}
        error={error}
        status={status}
      >
        {/* Conditionally render location list when we have results */}
        {structuredResponse && structuredResponse.locations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <LocationCardList 
              locations={structuredResponse.locations}
              onLocationSelect={handleLocationSelect}
              initialBatchSize={5}
              batchIncrement={3}
            />
          </div>
        )}
        
        {/* Sources section */}
        {structuredResponse && structuredResponse.sources && structuredResponse.sources.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-sm font-medium mb-2">Sources:</h3>
            <div className="space-y-2">
              {structuredResponse.sources.map((source: any, index: number) => (
                <a 
                  key={index}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary block hover:underline truncate"
                >
                  {source.title || source.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </DraggableContentOverlay>
    </div>
  );
}

// Main component that wraps the content with providers
export default function StructuredDemo() {
  return (
    <MapProvider>
      <StructuredDemoContent />
    </MapProvider>
  );
} 