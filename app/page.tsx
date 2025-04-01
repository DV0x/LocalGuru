"use client";

import { useState, useEffect } from "react";
import { SearchBar } from "@/components/search-bar";
import { ResultsContainer } from "@/components/results-container";
import { StreamingResults } from "@/components/streaming-results";
import { TravelRecommendation } from "@/components/result-card";
import { Compass, RefreshCw, Sparkles } from "lucide-react";
import { useStreamingSearch } from "@/hooks/use-streaming-search";

export default function Home() {
  // State for traditional search
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [results, setResults] = useState<TravelRecommendation[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [processingTime, setProcessingTime] = useState<number | undefined>();
  
  // New state for AI toggle
  const [useAISynthesis, setUseAISynthesis] = useState(true);
  
  // AI streaming search hook
  const {
    content,
    isLoading: isAILoading,
    searchResults: aiSearchResults,
    search: aiSearch,
    status,
    statusMessage,
    error: aiError
  } = useStreamingSearch();

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Traditional search implementation
  const handleTraditionalSearch = async (searchQuery: string, skipCache = false) => {
    setQuery(searchQuery);
    setIsLoading(true);
    setError(undefined);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          maxResults: 10,
          includeAnalysis: true,
          skipCache
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Error: ${response.status}`);
      }

      const data = await response.json();
      setResults(data.results);
      setIsCached(data.cached || false);
      setProcessingTime(data.processingTime);
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Combined search handler
  const handleSearch = (searchQuery: string) => {
    if (useAISynthesis) {
      // Use AI synthesis
      aiSearch(searchQuery);
    } else {
      // Use traditional search
      handleTraditionalSearch(searchQuery);
    }
  };

  const handleRefresh = () => {
    if (query) {
      handleTraditionalSearch(query, true); // Skip cache
    }
  };

  const handleFeedback = async (id: string, isPositive: boolean) => {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId: id,
          query: query,
          isHelpful: isPositive,
          feedbackSource: 'search_results'
        })
      });
      
      console.log(`Feedback for recommendation ${id}: ${isPositive ? 'positive' : 'negative'}`);
    } catch (error) {
      console.error("Error sending feedback:", error);
    }
  };
  
  // Determine if we have results to show
  const hasTraditionalResults = isLoading || error || results.length > 0;
  const hasAIResults = isAILoading || aiError || aiSearchResults.length > 0 || content;
  const hasResults = useAISynthesis ? hasAIResults : hasTraditionalResults;

  if (!mounted) {
    // Return a placeholder with the same structure to avoid layout shift
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 lg:p-12 bg-[#0f0f0f]">
        <div className="w-full max-w-3xl mx-auto text-center flex flex-col items-center justify-center">
          <div className="flex justify-center mb-6">
            <div className="bg-primary/10 p-3 rounded-full">
              <Compass className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-white">Localguru</h1>
          <p className="text-gray-400 mb-10 max-w-md mx-auto">
            Discover hidden gems and local insights for your next adventure
          </p>
          
          <div className="w-full px-4 md:px-0 max-w-2xl mx-auto">
            {/* Placeholder for SearchBar */}
            <div className="w-full h-14 bg-[#202123] rounded-xl border border-[#444654]/50 shadow-sm"></div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`flex min-h-screen flex-col ${hasResults ? 'items-center pt-12 pb-20' : 'items-center justify-center'} p-4 md:p-8 lg:p-12 bg-[#0f0f0f]`}>
      <div className={`w-full max-w-3xl mx-auto ${hasResults ? 'mb-8' : ''} text-center flex flex-col items-center ${!hasResults ? 'justify-center' : ''}`}>
        <div className="flex justify-center mb-6">
          <div className="bg-primary/10 p-3 rounded-full">
            <Compass className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3 text-white">Localguru</h1>
        <p className="text-gray-400 mb-10 max-w-md mx-auto">
          Discover hidden gems and local insights for your next adventure
        </p>
        
        <div className="w-full px-4 md:px-0 max-w-2xl mx-auto relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-purple-500/5 to-primary/20 rounded-2xl blur-xl opacity-30 animate-pulse" style={{ pointerEvents: 'none' }}></div>
          <div className="relative w-full backdrop-blur-sm z-10">
            <SearchBar onSearch={handleSearch} isLoading={useAISynthesis ? isAILoading : isLoading} />
          </div>
        </div>
      </div>

      {hasResults && (
        <>
          {useAISynthesis ? (
            // AI Streaming Results
            <StreamingResults
              content={content}
              searchResults={aiSearchResults}
              isLoading={isAILoading}
              status={status}
              statusMessage={statusMessage}
            />
          ) : (
            // Traditional Results
            <div className="w-full mt-8 max-w-3xl mx-auto">
              {results.length > 0 && (
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm text-gray-400">
                    {results.length} results {processingTime !== undefined && `(${processingTime}ms)`}
                    {isCached && <span className="ml-2 text-amber-400">(Cached)</span>}
                  </div>
                  {isCached && (
                    <button 
                      onClick={handleRefresh}
                      className="flex items-center text-sm text-primary hover:text-primary/80 transition-colors"
                      disabled={isLoading}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </button>
                  )}
                </div>
              )}
              <ResultsContainer
                results={results}
                isLoading={isLoading}
                error={error}
                onFeedback={handleFeedback}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
