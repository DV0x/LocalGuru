"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { ArrowUp, Square } from "lucide-react";

// Add TypeScript declarations for the Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SearchBarProps {
  onSearch: (query: string) => void;
  initialValue?: string;
  isLoading?: boolean;
  onStop?: () => void;
}

export function SearchBar({ onSearch, initialValue = "", isLoading = false, onStop }: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentPlaceholder, setCurrentPlaceholder] = useState("Search...");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  
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

  // Animate placeholder with smooth transitions
  useEffect(() => {
    if (query) return; // Don't animate if user has entered text

    let currentIndex = 0;
    
    const rotatePlaceholders = () => {
      setIsTransitioning(true);
      
      // After fade out, change text and fade back in
      setTimeout(() => {
        currentIndex = (currentIndex + 1) % exampleQueries.length;
        setCurrentPlaceholder(exampleQueries[currentIndex]);
        setIsTransitioning(false);
      }, 300); // Reduced from 600ms to 300ms
    };
    
    // Change placeholder text every 3 seconds (reduced from 4s)
    const intervalId = setInterval(rotatePlaceholders, 3000);
    
    // Initialize with first example
    setCurrentPlaceholder(exampleQueries[0]);
    
    return () => clearInterval(intervalId);
  }, [query]);

  // Focus input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Sync with initialValue when it changes
  useEffect(() => {
    if (initialValue !== undefined) {
      setQuery(initialValue);
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

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="search-input pr-16 text-base"
          placeholder={currentPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search query"
          autoFocus
          disabled={isLoading}
        />
          
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading ? (
            <button 
              type="button" 
              className={`offset-btn !py-1 !px-3 text-sm ${isStopping ? 'bg-red-700' : 'bg-red-500'} transform transition-all duration-150 ${isStopping ? 'scale-95' : 'scale-100'}`}
              onClick={handleStopSearch}
              aria-label="Stop search"
            >
              <Square size={16} className="text-white" />
            </button>
          ) : (
            <button 
              type="submit" 
              className="offset-btn !py-1 !px-3 text-sm" 
              disabled={!query.trim()}
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        input::placeholder {
          transition: opacity 0.3s ease, transform 0.3s ease;
          opacity: ${isTransitioning ? 0 : 0.65};
          transform: translateY(${isTransitioning ? '5px' : '0'});
        }
      `}</style>
    </form>
  );
} 