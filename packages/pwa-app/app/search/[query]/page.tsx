"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useStreamingSearch } from "@/app/hooks/use-streaming-search";
import { SearchBar } from "@/app/components/search-bar";
import { MapPlaceholder } from "@/app/components/map-placeholder";
import { DraggableContentOverlay, DraggableContentOverlayRef } from "@/app/components/draggable-content-overlay";

export default function SearchResultsPage() {
  const params = useParams();
  const router = useRouter();
  const [location, setLocation] = useState("San Francisco");
  const hasInitializedRef = useRef(false);
  const overlayRef = useRef<DraggableContentOverlayRef>(null);
  
  // Extract query from URL parameters and decode it
  const queryParam = typeof params.query === 'string' ? params.query : params.query?.[0] || '';
  const decodedQuery = decodeURIComponent(queryParam);
  
  // Initialize streaming search hook
  const { status, results, content, error, search, stopSearch, isLoading } = useStreamingSearch();
  
  // Start search when page loads with the URL query
  useEffect(() => {
    // Prevent multiple search initializations due to React 18 StrictMode
    if (decodedQuery && !hasInitializedRef.current) {
      console.log('Initializing search for query:', decodedQuery);
      
      // Set search as initialized FIRST to prevent race conditions
      hasInitializedRef.current = true;
      
      // Set timeout to ensure the component is fully mounted
      // This helps prevent the race condition causing the abort
      setTimeout(() => {
        // First expand the overlay and wait a moment for it to begin expanding
        if (overlayRef.current) {
          console.log('Expanding overlay from initial search');
          overlayRef.current.expand();
          
          // Then start the search after a small delay to let the expansion begin
          setTimeout(() => {
            search(decodedQuery, location);
          }, 50);
        } else {
          // If overlay ref isn't available, just search
          search(decodedQuery, location);
        }
      }, 100);
    }
    
    // Cleanup function to prevent search from being aborted when 
    // the dependency array causes a re-render
    return () => {
      // We don't stop the search on cleanup to prevent early abort
      console.log('Search effect cleanup - NOT stopping search');
    };
  }, [decodedQuery, location]);
  
  // Handle new search from the search bar
  const handleSearch = (newQuery: string) => {
    // Log for debugging
    console.log('New search initiated for:', newQuery);
    
    // Track success of overlay expansion
    let expansionTriggered = false;
    
    // First and MOST IMPORTANTLY, expand the overlay
    if (overlayRef.current) {
      console.log('Expanding overlay for new search');
      overlayRef.current.expand();
      expansionTriggered = true;
    } else {
      console.warn('Overlay ref not available for expansion');
    }
    
    // Mark search as not initialized so we can search again
    hasInitializedRef.current = false;
    
    // Small delay to ensure the expansion begins first
    window.requestAnimationFrame(() => {
      // If expansion was successful, add a delay before searching
      const searchDelay = expansionTriggered ? 50 : 0;
      
      setTimeout(() => {
        // Update URL when search changes - do this BEFORE search to avoid timing issues
        router.push(`/search/${encodeURIComponent(newQuery)}`);
        
        // Finally start the search
        search(newQuery, location);
        
        console.log(`Search started for: ${newQuery} with ${searchDelay}ms delay`);
      }, searchDelay);
    });
  };
  
  // Handle location change from the search bar
  const handleLocationChange = (newLocation: string) => {
    console.log("Location changed:", newLocation);
    
    // Update location state
    setLocation(newLocation);
    
    // If we have an active query, refresh search with new location
    if (decodedQuery) {
      // Track success of overlay expansion
      let expansionTriggered = false;
      
      // First expand the overlay
      if (overlayRef.current) {
        console.log('Expanding overlay for location change');
        overlayRef.current.expand();
        expansionTriggered = true;
      } else {
        console.warn('Overlay ref not available for expansion');
      }
      
      // Reset search initialized flag
      hasInitializedRef.current = false;
      
      // Small delay to ensure expansion begins first
      window.requestAnimationFrame(() => {
        // If expansion was successful, add a delay before searching
        const searchDelay = expansionTriggered ? 50 : 0;
        
        setTimeout(() => {
          // Start the search with the new location
          search(decodedQuery, newLocation);
          
          console.log(`Search with new location: ${newLocation} with ${searchDelay}ms delay`);
        }, searchDelay);
      });
    }
  };
  
  // Handle stop search
  const handleStopSearch = () => {
    stopSearch();
  };
  
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Fixed search bar at the top */}
      <div className="absolute inset-x-0 top-0 z-40 p-4 bg-background/80 backdrop-blur-md">
        <SearchBar
          onSearch={handleSearch}
          initialValue={decodedQuery}
          initialLocation={location}
          onLocationChange={handleLocationChange}
          isLoading={isLoading}
          onStop={handleStopSearch}
        />
      </div>
      
      {/* Full-screen map area */}
      <div className="absolute inset-0 z-10 pt-24">
        <MapPlaceholder location={location} />
      </div>
      
      {/* Draggable content overlay */}
      <DraggableContentOverlay
        ref={overlayRef}
        content={content}
        results={results}
        isLoading={isLoading}
        error={error}
        status={status}
      />
    </div>
  );
} 