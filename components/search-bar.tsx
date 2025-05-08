"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { ArrowUp, Square, ArrowUpCircle } from "lucide-react";
import { LocationSelector } from "./location-selector";
import { SearchBarProps } from "@/app/lib/types/search-components";
import styles from "./search-styles.module.css";

// Add TypeScript declarations for the Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function SearchBar({ 
  onSearch, 
  initialValue = "", 
  isLoading = false, 
  onStop,
  onLocationChange,
  initialLocation
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [currentPlaceholder, setCurrentPlaceholder] = useState("Search...");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
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

  // Sync with initialValue when it changes
  useEffect(() => {
    if (initialValue !== undefined && textareaRef.current) {
      setQuery(initialValue);
      textareaRef.current.value = initialValue;
      setShowPlaceholder(!initialValue);
      autoResizeTextarea();
    }
  }, [initialValue]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query);
    }
  };

  const handleStopSearch = (e: React.MouseEvent) => {
    // Prevent form submission
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Stop button clicked, preventing form submission');
    
    // Show immediate visual feedback
    setIsStopping(true);
    
    if (onStop) {
      console.log('Calling onStop callback');
      onStop();
    }
    
    // Reset the stopping state after a short delay
    setTimeout(() => {
      setIsStopping(false);
    }, 300);
  };
  
  // Handle key press for textarea (Enter to submit)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (query.trim() && !isLoading) {
        onSearch(query);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.searchContainer}>
      <div className="relative">
        <textarea 
          ref={textareaRef}
          className={styles.searchInput}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          aria-label="Search query"
          rows={2} 
          placeholder=""
          style={{ paddingBottom: '40px' }} 
        />
        
        {showPlaceholder && (
          <div className="absolute top-3 left-3 text-gray-400 pointer-events-none text-base" 
               style={{
                 opacity: isTransitioning ? 0 : 0.75,
                 transform: `translateY(${isTransitioning ? '5px' : '0'})`,
                 transition: 'opacity 0.3s ease, transform 0.3s ease'
               }}>
            {currentPlaceholder}
          </div>
        )}
          
        <div className="absolute right-4 bottom-3.5 flex items-center gap-1 z-20">
          {isLoading ? (
            <button 
              type="button" 
              className={`bg-red-500 ${isStopping ? 'scale-95' : 'scale-100'}`}
              onClick={handleStopSearch}
              aria-label="Stop search"
              style={{
                height: '36px',
                width: '36px',
                border: '2px solid black',
                borderRadius: '6px',
                boxShadow: '3px 3px 0 0 #000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease-in-out'
              }}
            >
              <Square size={14} className="text-black" />
            </button>
          ) : (
            <button 
              type="submit" 
              className={styles.searchButton}
              disabled={!query.trim()}
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>

        {/* Location Selector Pill */}
        {onLocationChange && (
          <div className="absolute left-3 bottom-3 z-20">
            <LocationSelector 
              onLocationChange={onLocationChange} 
              initialLocation={initialLocation}
              variant="ultra-compact"
            />
          </div>
        )}
      </div>
    </form>
  );
} 