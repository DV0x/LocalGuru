"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import { FloatingSearchBarProps } from "@/app/lib/types/search-components";
import styles from "./search-styles.module.css";

export function FloatingSearchBar({ onSearch, visible, isLoading = false, onStop }: FloatingSearchBarProps) {
  const [query, setQuery] = useState("");
  const [animation, setAnimation] = useState<"entering" | "exiting" | "idle">("idle");
  const [isVisible, setIsVisible] = useState(false);
  const [currentPlaceholder, setCurrentPlaceholder] = useState("Search...");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
    if (query || !isVisible) return; // Don't animate if user has entered text or bar is hidden

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
  }, [query, isVisible]);

  // Handle visibility changes with smoother animations
  useEffect(() => {
    if (visible) {
      // Make element visible first, then animate
      setIsVisible(true);
      // Short delay before starting animation
      setTimeout(() => {
        setAnimation("entering");
        setTimeout(() => {
          setAnimation("idle");
          inputRef.current?.focus();
        }, 400);
      }, 10);
    } else {
      setAnimation("exiting");
      // Remove from DOM after animation completes
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 250);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [visible]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query);
      setQuery("");
    }
  };

  const handleStopSearch = (e: React.MouseEvent) => {
    // Prevent form submission
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Floating search bar: Stop button clicked, preventing form submission');
    
    // Show immediate visual feedback
    setIsStopping(true);
    
    if (onStop) {
      console.log('Floating search bar: Calling onStop callback');
      onStop();
    }
    
    // Reset the stopping state after a short delay
    setTimeout(() => {
      setIsStopping(false);
    }, 300);
  };

  // Handle escape key to clear input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && query) {
        setQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [query]);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-[1000] px-4 w-full max-w-xl will-change-transform will-change-opacity
        ${animation === "entering" ? "animate-fade-in" : ""}
        ${animation === "exiting" ? "animate-fade-out" : ""}`}
    >
      <form 
        ref={formRef}
        onSubmit={handleSubmit} 
        className={`${styles.floatingSearchContainer} shadow-xl w-full cursor-text`}
      >
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            className={`${styles.searchInput} !min-h-12 pr-16 text-base cursor-text`}
            placeholder={currentPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search query"
            disabled={isLoading}
          />
          
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isLoading ? (
              <button 
                type="button" 
                className={`offset-btn !py-1 !px-3 text-sm ${isStopping ? 'bg-red-700' : 'bg-red-500'} cursor-pointer transform transition-all duration-150 ${isStopping ? 'scale-95' : 'scale-100'}`}
                onClick={handleStopSearch}
                aria-label="Stop search"
              >
                <Square size={16} className="text-white" />
              </button>
            ) : (
              <button 
                type="submit" 
                className="offset-btn !py-1 !px-3 text-sm cursor-pointer" 
                disabled={!query.trim()}
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>
      </form>
      
      <style jsx global>{`
        @keyframes fadeIn {
          0% { 
            opacity: 0; 
            transform: translate(-50%, 15px);
          }
          100% { 
            opacity: 1; 
            transform: translate(-50%, 0);
          }
        }
        
        @keyframes fadeOut {
          0% { 
            opacity: 1; 
            transform: translate(-50%, 0);
          }
          100% { 
            opacity: 0; 
            transform: translate(-50%, 15px);
          }
        }
        
        .animate-fade-in {
          animation: fadeIn 400ms ease-out forwards;
        }
        
        .animate-fade-out {
          animation: fadeOut 250ms ease-in forwards;
        }
        
        .will-change-transform {
          will-change: transform;
        }
        
        .will-change-opacity {
          will-change: opacity;
        }
        
        /* Ensure cursor is text type on the search bar */
        .floating-search-container,
        .floating-search-container .search-input {
          cursor: text !important;
        }
        
        /* But use pointer cursor for buttons */
        .floating-search-container button {
          cursor: pointer !important;
        }
        
        /* Placeholder animation */
        .floating-search-container input::placeholder {
          transition: opacity 0.3s ease, transform 0.3s ease;
          opacity: ${isTransitioning ? 0 : 0.75};
          transform: translateY(${isTransitioning ? '5px' : '0'});
        }
      `}</style>
    </div>
  );
} 