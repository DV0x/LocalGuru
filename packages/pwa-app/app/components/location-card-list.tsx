"use client";

import { useRef, useEffect, useState } from "react";
import { MapPin, Star, DollarSign, Clock, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { LocationData } from "../lib/api/location-client";
import { useMapContext } from "../contexts/map-context";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

interface LocationCardListProps {
  locations: LocationData[] | any[];
  onLocationSelect?: (location: LocationData | any, index: number) => void;
  initialBatchSize?: number;
  batchIncrement?: number;
}

export function LocationCardList({
  locations,
  onLocationSelect,
  initialBatchSize = 5,
  batchIncrement = 3
}: LocationCardListProps) {
  const [visibleLocations, setVisibleLocations] = useState<number>(initialBatchSize);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const { flyToLocation } = useMapContext();
  const listRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  
  // Format price range
  const formatPrice = (priceRange?: string | number) => {
    if (!priceRange) return null;
    return typeof priceRange === 'string' 
      ? priceRange 
      : Array(priceRange).fill('$').join('');
  };
  
  // Handle card selection
  const handleCardClick = (location: any, index: number) => {
    setSelectedIndex(index);
    
    // If the location has coordinates, fly to them
    if (location.coordinates?.latitude && location.coordinates?.longitude) {
      flyToLocation(location.coordinates.longitude, location.coordinates.latitude, 16);
    } else if (location.longitude && location.latitude) {
      flyToLocation(location.longitude, location.latitude, 16);
    }
    
    // Call the external handler if provided
    if (onLocationSelect) {
      onLocationSelect(location, index);
    }
  };
  
  // Toggle description expansion
  const toggleDescription = (e: React.MouseEvent, locationId: string) => {
    e.stopPropagation(); // Prevent card click
    
    const newExpandedDescriptions = new Set(expandedDescriptions);
    if (expandedDescriptions.has(locationId)) {
      newExpandedDescriptions.delete(locationId);
    } else {
      newExpandedDescriptions.add(locationId);
    }
    setExpandedDescriptions(newExpandedDescriptions);
  };
  
  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (!loadingRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          // Load more locations when the loading element is visible
          setVisibleLocations(prev => 
            Math.min(prev + batchIncrement, locations.length)
          );
        }
      },
      { threshold: 0.1 }
    );
    
    observer.observe(loadingRef.current);
    
    return () => {
      if (loadingRef.current) {
        observer.unobserve(loadingRef.current);
      }
    };
  }, [locations.length, batchIncrement]);
  
  // Reset visible count when locations change
  useEffect(() => {
    setVisibleLocations(initialBatchSize);
    setSelectedIndex(null);
    setExpandedDescriptions(new Set());
  }, [locations, initialBatchSize]);
  
  // If no locations available
  if (!locations || locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <MapPin className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No locations found</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4" ref={listRef}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-base font-medium">Found {locations.length} Locations</h3>
      </div>
      
      {/* Render visible locations */}
      {locations.slice(0, visibleLocations).map((location, index) => {
        const locationId = location.id || `location-${index}`;
        const isExpanded = expandedDescriptions.has(locationId);
        const description = location.description || location.source_text || "";
        const hasLongDescription = description.length > 100; // Threshold for showing expand button
          
        return (
          <div
            key={locationId}
            className={cn(
              "rounded-lg border border-border bg-card p-4 transition-all duration-200",
              selectedIndex === index ? "ring-2 ring-primary" : "hover:border-primary/50"
            )}
            onClick={() => handleCardClick(location, index)}
          >
            <div className="flex justify-between">
              <h3 className="text-base font-semibold mb-1 line-clamp-1">{location.name}</h3>
              
              <div className="flex items-center gap-2">
                {/* Price range tag */}
                {formatPrice(location.price_range) && (
                  <div className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
                    {formatPrice(location.price_range)}
                  </div>
                )}
                
                {/* Rating */}
                {location.rating && (
                  <div className="flex items-center text-xs bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full">
                    <Star className="h-3 w-3 mr-1" />
                    <span>{location.rating}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Address */}
            <p className="text-xs text-muted-foreground mb-3">{location.address}</p>
            
            {/* Category tag */}
            {location.category && (
              <div className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded inline-block mb-2">
                {location.category}
              </div>
            )}
            
            {/* Hours */}
            {location.hours && (
              <div className="flex items-center text-xs text-muted-foreground mb-2">
                <Clock className="h-3 w-3 mr-1" />
                <span>{location.hours}</span>
              </div>
            )}
            
            {/* Description with expand/collapse */}
            <div className="mb-3">
              <p className={cn(
                "text-sm",
                !isExpanded && hasLongDescription ? "line-clamp-2" : ""
              )}>
                {description}
              </p>
              
              {/* Show expand/collapse button for long descriptions */}
              {hasLongDescription && (
                <button 
                  className="flex items-center text-xs text-primary mt-1 hover:underline focus:outline-none"
                  onClick={(e) => toggleDescription(e, locationId)}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5 mr-1" />
                      <span>Show less</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5 mr-1" />
                      <span>Read more</span>
                    </>
                  )}
                </button>
              )}
            </div>
            
            {/* Highlights (if available) */}
            {isExpanded && location.highlights && location.highlights.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Highlights:</p>
                <ul className="text-xs space-y-0.5 pl-4 list-disc">
                  {location.highlights.map((highlight: string, i: number) => (
                    <li key={i}>{highlight}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex gap-2 mt-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 h-8 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  // Fly to location
                  if (location.coordinates?.latitude && location.coordinates?.longitude) {
                    flyToLocation(location.coordinates.longitude, location.coordinates.latitude, 16);
                  } else if (location.longitude && location.latitude) {
                    flyToLocation(location.longitude, location.latitude, 16);
                  }
                }}
              >
                <MapPin className="h-3.5 w-3.5 mr-1" />
                View on Map
              </Button>
              
              <Button 
                variant="default" 
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  // Open in Google Maps
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${location.name} ${location.address}`
                    )}`,
                    '_blank'
                  );
                }}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Directions
              </Button>
            </div>
          </div>
        );
      })}
      
      {/* Show loading indicator if more locations available */}
      {visibleLocations < locations.length && (
        <div
          ref={loadingRef}
          className="py-4 flex justify-center items-center"
        >
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div>
          <span className="text-xs text-muted-foreground">
            Loading more locations...
          </span>
        </div>
      )}
    </div>
  );
} 