"use client";

import { useState, useEffect } from "react";
import { SearchBar } from "@/components/search-bar";
import { LocationSelector } from "@/components/location-selector";
import { ScrollingBanner } from "@/components/scrolling-banner";
import { ResultsContainer } from "@/components/results-container";
import { StreamingResults } from "@/components/streaming-results";
import { FloatingSearchBar } from "@/components/floating-search-bar";
import { TravelRecommendation } from "@/components/result-card";
import { Compass } from "lucide-react";
import { useStreamingSearch } from "@/hooks/use-streaming-search";

export default function Home() {
  const { content, searchResults, isLoading, search, status, statusMessage, setInput } = useStreamingSearch();
  const [showFloatingSearch, setShowFloatingSearch] = useState(false);
  const [shouldRenderFloatingSearch, setShouldRenderFloatingSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Handle scroll to show/hide floating search bar with improved detection and throttling
  useEffect(() => {
    let lastScrollTime = 0;
    const throttleDelay = 100; // ms
    
    const handleScroll = () => {
      const now = Date.now();
      
      // Throttle scroll events
      if (now - lastScrollTime < throttleDelay) return;
      lastScrollTime = now;
      
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const pageHeight = document.body.scrollHeight;
      
      // Calculate how far down the user has scrolled as a percentage
      const scrollPercentage = (scrollPosition / (pageHeight - windowHeight)) * 100;
      
      // Get the main search section and footer
      const mainSearchSection = document.querySelector('.neo-card');
      const footer = document.querySelector('.scrolling-banner') || document.querySelector('footer');
      
      let shouldShow = false;
      
      // First check if we're near the footer - if so, always hide the search bar
      if (footer) {
        const footerRect = footer.getBoundingClientRect();
        // If footer is visible or almost visible, hide the search bar
        const footerVisible = footerRect.top < windowHeight + 100;
        
        if (footerVisible) {
          shouldShow = false;
        } else if (mainSearchSection) {
          // Get the bottom position of the main search bar
          const rect = mainSearchSection.getBoundingClientRect();
          const searchSectionBottom = rect.bottom;
          
          // Show floating search bar as soon as the main search disappears from viewport
          const searchTriggerPoint = 0; // Changed from -50 to 0
          
          // Show when scrolled past the search section
          shouldShow = searchSectionBottom < searchTriggerPoint;
        } else {
          // Fallback to percentage-based
          shouldShow = scrollPercentage > 20 && scrollPercentage < 85;
        }
      }
      
      if (shouldShow !== showFloatingSearch) {
        setShowFloatingSearch(shouldShow);
        
        if (shouldShow) {
          setShouldRenderFloatingSearch(true);
        } else {
          setTimeout(() => {
            setShouldRenderFloatingSearch(false);
          }, 400);
        }
      }
    };

    // Run once on mount to check initial position
    handleScroll();
    
    // Add scroll listener
    window.addEventListener("scroll", handleScroll);
    
    // Clean up
    return () => window.removeEventListener("scroll", handleScroll);
  }, [showFloatingSearch]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (setInput) setInput(query); // Update input in the hook if available
    search(query);
    
    // Scroll to a position where the results are visible
    const scrollTarget = document.querySelector('.neo-card');
    if (scrollTarget) {
      window.scrollTo({
        top: scrollTarget.getBoundingClientRect().top + window.scrollY - 120, // Add some padding
        behavior: 'smooth'
      });
    } else {
      // Fallback if the element isn't found
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b-2 border-black py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Compass className="h-6 w-6" />
            <span className="font-bold text-xl">JUSTLOCAL.AI</span>
          </div>
          <LocationSelector />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow isometric-grid pt-16 pb-16">
        <div className="container mx-auto px-4 relative z-10">
          {/* Hero section */}
          <div className="neo-card p-8 mb-8 max-w-4xl mx-auto">
            <h1 className="text-5xl font-black mb-8 tracking-tight text-center">What can I help you to discover?</h1>

            <SearchBar onSearch={handleSearch} initialValue={searchQuery} />
      </div>

          {/* Streaming Results section */}
          {(content || isLoading || status === "searching" || status === "generating" || status === "search_complete" || status === "complete") && (
            <StreamingResults
              content={content}
              searchResults={searchResults}
              isLoading={isLoading}
              status={status}
              statusMessage={statusMessage}
            />
          )}
        </div>
      </main>

      {/* Floating search bar */}
      {shouldRenderFloatingSearch && (
        <FloatingSearchBar onSearch={handleSearch} visible={showFloatingSearch} />
      )}

      {/* Footer banner */}
      <ScrollingBanner text="FIND HIDDEN GEMS • DISCOVER LOCAL FAVORITES • EXPLORE LIKE A LOCAL • AUTHENTIC RECOMMENDATIONS" />
    </div>
  );
}
