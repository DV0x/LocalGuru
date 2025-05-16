"use client";

import dynamic from 'next/dynamic';
import { useMapContext } from '../contexts/map-context';
import { Skeleton } from './ui/skeleton';
import MapErrorBoundary from './ui/map-error-boundary';
import { Loader2 } from 'lucide-react';

// Dynamic import to prevent SSR issues with mapbox
const InteractiveMap = dynamic(
  () => import('./ui/interactive-map'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-900 rounded-lg">
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    )
  }
);

interface MapPlaceholderProps {
  location?: string;
}

type LocationCoordinates = {
  [key: string]: { longitude: number; latitude: number };
};

// Component to show loading state over the map
const MapLoadingOverlay = () => (
  <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20 backdrop-blur-sm">
    <div className="bg-card/90 p-4 rounded-lg shadow-lg flex items-center gap-3">
      <Loader2 className="w-5 h-5 text-primary animate-spin" />
      <span className="text-sm font-medium">Extracting locations...</span>
    </div>
  </div>
);

export function MapPlaceholder({ location = 'San Francisco' }: MapPlaceholderProps) {
  // Get map context to access loading state and features
  const { isLoadingLocations, searchResultFeatures } = useMapContext();
  
  // Default coordinates for supported locations
  const locationCoordinates: LocationCoordinates = {
    'San Francisco': { longitude: -122.4194, latitude: 37.7749 },
    // Add other cities as they become available
  };

  const coordinates = locationCoordinates[location] || locationCoordinates['San Francisco'];

  return (
    <div className="w-full h-full rounded-lg overflow-hidden relative">
      <MapErrorBoundary>
        <InteractiveMap initialLocation={coordinates} />
        {isLoadingLocations && <MapLoadingOverlay />}
      </MapErrorBoundary>
      
      {/* Show pin count when we have features */}
      {searchResultFeatures.length > 0 && (
        <div className="absolute top-4 right-4 bg-card/80 text-card-foreground px-3 py-1.5 rounded-full backdrop-blur-sm z-10 shadow-lg text-xs font-medium">
          {searchResultFeatures.length} {searchResultFeatures.length === 1 ? 'location' : 'locations'} found
        </div>
      )}
    </div>
  );
} 