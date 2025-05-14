"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Textarea } from "@/app/components/ui/textarea";
import { Button } from "@/app/components/ui/button";
import { LocationSelector } from "@/app/components/location-selector";
import { cn } from "@/app/lib/utils";

export interface SearchBarProps {
  onSearch: (query: string) => void;
  initialValue?: string;
  isLoading?: boolean;
  onStop?: () => void;
  onLocationChange?: (location: string) => void;
  initialLocation?: string;
}

export function SearchBar({ 
  onSearch, 
  initialValue = "", 
  isLoading = false, 
  onStop,
  onLocationChange,
  initialLocation = "San Francisco"
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [currentPlaceholder, setCurrentPlaceholder] = useState("Search...");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(!initialValue);
  
  // Example search queries for animation
  const exampleQueries = [
    "Best coffee shops in the Mission",
    "Hidden gems for dinner",
    "Morning running tracks with scenic views",
    "Rooftop bars with a view",
    "Local craft breweries",
    "Weekend brunch spots",
    "Best Asian restaurants",
  ];

  // Auto-resize textarea based on content
  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      // Reset height to auto to get the correct scrollHeight
      textareaRef.current.style.height = 'auto';
      // Set the height based on scrollHeight (content height)
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setQuery(text);
    setShowPlaceholder(!text);
    autoResizeTextarea();
  };

  // Animate placeholder with smooth transitions
  useEffect(() => {
    if (query) {
      setShowPlaceholder(false);
      return;
    }
    
    setShowPlaceholder(true);
    let currentIndex = 0;
    
    const rotatePlaceholders = () => {
      setIsTransitioning(true);
      
      // After fade out, change text and fade back in
      setTimeout(() => {
        currentIndex = (currentIndex + 1) % exampleQueries.length;
        setCurrentPlaceholder(exampleQueries[currentIndex]);
        setIsTransitioning(false);
      }, 300);
    };
    
    // Change placeholder text every 3 seconds
    const intervalId = setInterval(rotatePlaceholders, 3000);
    
    // Initialize with first example
    setCurrentPlaceholder(exampleQueries[0]);
    
    return () => clearInterval(intervalId);
  }, [query]);

  // Focus input when component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      
      // Set initial content if there's an initial value
      if (initialValue) {
        textareaRef.current.value = initialValue;
        autoResizeTextarea();
      }
    }
  }, [initialValue]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    // Ensure we prevent default behavior to avoid navigation
    e.preventDefault();
    e.stopPropagation();
    
    // Only perform search if we have a query and aren't already loading
    if (query.trim() && !isLoading) {
      // Give immediate visual feedback that the search is being processed
      textareaRef.current?.blur(); // Blur to hide keyboard on mobile
      
      // Call the search handler with a slight delay to allow UI updates
      requestAnimationFrame(() => {
        onSearch(query);
      });
    }
  };

  // Handle search stopping
  const handleStopSearch = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onStop) {
      onStop();
    }
  };

  // Handle key press for textarea (Enter to submit)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (query.trim() && !isLoading) {
        // Give immediate visual feedback that the search is being processed
        textareaRef.current?.blur(); // Blur to hide keyboard on mobile
        
        // Call the search handler with a slight delay to allow UI updates
        requestAnimationFrame(() => {
          onSearch(query);
        });
      }
    }
  };

  // Handle location change
  const handleLocationChange = (newLocation: string) => {
    if (onLocationChange) {
      onLocationChange(newLocation);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto relative z-30">
      <div className="relative bg-background rounded-md shadow-lg">
        <Textarea
          ref={textareaRef}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          aria-label="Search query"
          placeholder=""
          className="min-h-[75px] pb-12 bg-background border border-input dark:shadow-purple-900/20 focus-visible:ring-primary relative z-20"
        />
        
        {showPlaceholder && (
          <div 
            className="absolute top-3 left-3 text-muted-foreground pointer-events-none text-sm z-30"
            style={{
              opacity: isTransitioning ? 0 : 0.75,
              transform: `translateY(${isTransitioning ? '5px' : '0'})`,
              transition: 'opacity 0.3s ease, transform 0.3s ease'
            }}
          >
            {currentPlaceholder}
          </div>
        )}
        
        {/* Submit or Stop Button */}
        <div className="absolute right-3 bottom-3 z-30">
          {isLoading ? (
            <Button 
              type="button" 
              size="icon"
              variant="destructive"
              onClick={handleStopSearch}
              aria-label="Stop search"
              className="cursor-pointer"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              variant="default"
              disabled={!query.trim()}
              className="cursor-pointer"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* Location Selector */}
        <div className="absolute left-3 bottom-3 z-30">
          <LocationSelector 
            onLocationChange={handleLocationChange}
            initialLocation={`${initialLocation}, CA`}
            variant="mini"
          />
        </div>
      </div>
    </form>
  );
} 