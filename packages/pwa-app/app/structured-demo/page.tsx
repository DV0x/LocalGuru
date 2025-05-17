"use client";

import { useState } from 'react';
import { SearchBar } from '../components/search-bar';
import { DraggableContentOverlay } from '../components/draggable-content-overlay';
import { MapPlaceholder } from '../components/map-placeholder';
import { MapProvider, useMapContext } from '../contexts/map-context';
import { useStructuredSearch } from '../hooks/use-structured-search';
import { LocationCardList } from '../components/location-card-list';
import { FarcasterLocationCard } from '../components/farcaster-location-card';
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
    farcasterResults,
    farcasterLocations,
    isFarcasterLoading,
    enhancedSearch,
    activeResultsTab,
    toggleResultsTab,
    isLoading
  } = useStructuredSearch();
  
  // Selected location for details
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  
  // Selected index by tab for highlighting
  const [selectedStructuredIndex, setSelectedStructuredIndex] = useState<number | null>(null);
  const [selectedSocialIndex, setSelectedSocialIndex] = useState<number | null>(null);
  
  // Track the currently selected city
  const [currentCity, setCurrentCity] = useState<string>("San Francisco");
  
  // Get map context for interactions
  const mapContext = useMapContext();
  
  // Handle search submission
  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      console.log(`Searching for "${searchQuery}" in location: "${currentCity}"`);
      // Use enhanced search instead of regular search
      enhancedSearch(searchQuery, currentCity);
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
      enhancedSearch(query, location);
    } else {
      console.log('No active query to search with the new location');
    }
  };
  
  // Handle selecting a location from the structured list
  const handleStructuredLocationSelect = (location: any, index: number) => {
    console.log(`Selected structured location: ${location.name}`);
    setSelectedLocation(location);
    setSelectedStructuredIndex(index);
    setSelectedSocialIndex(null);
    
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
  
  // Handle selecting a location from the social list
  const handleSocialLocationSelect = (location: any, index: number) => {
    console.log(`Selected social location: ${location.name}`);
    setSelectedLocation(location);
    setSelectedSocialIndex(index);
    setSelectedStructuredIndex(null);
    
    // If this location has coordinates, fly to it on the map
    if (location.latitude && location.longitude) {
      // Set the feature ID to highlight the pin
      mapContext.setSelectedFeatureId(location.id);
      
      // Fly to the location
      mapContext.flyToLocation(
        location.longitude,
        location.latitude,
        15 // Zoom level
      );
    }
  };
  
  // Handle toggling between structured and social results
  const handleToggleTab = (tab: 'structured' | 'social') => {
    toggleResultsTab(tab);
    // Reset selected location when switching tabs
    setSelectedLocation(null);
    setSelectedStructuredIndex(null);
    setSelectedSocialIndex(null);
  };
  
  return (
    <div className="relative flex flex-col h-screen bg-background">
      {/* Search Header */}
      <header className="absolute top-0 left-0 right-0 z-40 p-4">
        <div className="text-center mb-2">
          <div className="text-sm font-medium text-primary">
            Local Search Demo
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Try searching in different cities by changing the location!
          </div>
        </div>
        <SearchBar 
          onSearch={handleSearch} 
          initialValue={query}
          isLoading={isLoading || isFarcasterLoading}
          onLocationChange={handleLocationChange}
        />
      </header>
      
      {/* Map (Full Screen) */}
      <div className="flex-grow w-full h-full">
        <MapPlaceholder />
      </div>
      
      {/* Draggable Content Overlay with support for toggling */}
      <DraggableContentOverlay
        ref={overlayRef}
        content={content}
        results={results}
        isLoading={isLoading || isFarcasterLoading}
        error={error}
        status={status}
        structuredResponse={structuredResponse}
        farcasterLocations={farcasterLocations}
        activeResultsTab={activeResultsTab}
        onToggleTab={handleToggleTab}
      >
        {/* Show structured or social results based on active tab */}
        {activeResultsTab === 'structured' && structuredResponse && structuredResponse.locations.length > 0 && (
          <div className="mt-4">
            <LocationCardList 
              locations={structuredResponse.locations}
              onLocationSelect={handleStructuredLocationSelect}
              initialBatchSize={5}
              batchIncrement={3}
            />
          </div>
        )}
        
        {/* Show Farcaster social results when social tab is active */}
        {activeResultsTab === 'social' && farcasterLocations && farcasterLocations.length > 0 && (
          <div className="mt-4 space-y-4">
            {farcasterLocations.map((location, index) => (
              <FarcasterLocationCard 
                key={`farcaster-${location.id || index}`}
                location={location}
                onLocationSelect={handleSocialLocationSelect}
                index={index}
                isSelected={selectedSocialIndex === index}
              />
            ))}
          </div>
        )}
        
        {/* Sources section - only show for structured results */}
        {activeResultsTab === 'structured' && structuredResponse && structuredResponse.sources && structuredResponse.sources.length > 0 && (
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
        
        {/* No results message when appropriate */}
        {!isLoading && !isFarcasterLoading && !error && (
          <>
            {activeResultsTab === 'structured' && (!structuredResponse || structuredResponse.locations.length === 0) && (
              <div className="mt-4 p-4 text-center text-muted-foreground">
                <p>No official results found. Try the social tab for community recommendations.</p>
              </div>
            )}
            
            {activeResultsTab === 'social' && (!farcasterLocations || farcasterLocations.length === 0) && (
              <div className="mt-4 p-4 text-center text-muted-foreground">
                <p>No social recommendations found. Try the official tab for curated results.</p>
              </div>
            )}
          </>
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