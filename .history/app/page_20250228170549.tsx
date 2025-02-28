"use client";

import { useState, useEffect } from "react";
import { SearchBar } from "@/components/search-bar";
import { ResultsContainer } from "@/components/results-container";
import { TravelRecommendation } from "@/components/result-card";
import { Compass } from "lucide-react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [results, setResults] = useState<TravelRecommendation[]>([]);
  const [mounted, setMounted] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    setIsLoading(true);
    setError(undefined);

    try {
      // In a real implementation, this would call the backend API
      // For now, we'll simulate a delay and return mock data
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock data for demonstration
      if (searchQuery.toLowerCase().includes("error")) {
        throw new Error("Failed to fetch recommendations. Please try again.");
      }
      
      const mockResults: TravelRecommendation[] = [
        {
          id: "1",
          title: "Hidden Beach in Tulum",
          location: "Tulum, Mexico",
          description: "A secluded beach accessible only through a small cave. Perfect for avoiding crowds and enjoying pristine waters.",
          tags: ["beach", "secluded", "swimming"],
          source: "r/TravelHacks",
          sourceUrl: "https://reddit.com/r/TravelHacks"
        },
        {
          id: "2",
          title: "Local Food Market in Bangkok",
          location: "Bangkok, Thailand",
          description: "An authentic food market where locals shop. Try the mango sticky rice from the vendor in the northeast corner.",
          tags: ["food", "local", "market"],
          source: "r/Travel",
          sourceUrl: "https://reddit.com/r/Travel"
        },
        {
          id: "3",
          title: "Secret Viewpoint in Kyoto",
          location: "Kyoto, Japan",
          description: "A lesser-known temple with an amazing view of the city. Go at sunset for the best experience.",
          tags: ["viewpoint", "temple", "sunset"],
          source: "r/JapanTravel",
          sourceUrl: "https://reddit.com/r/JapanTravel"
        }
      ];
      
      setResults(mockResults);
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = (id: string, isPositive: boolean) => {
    // In a real implementation, this would send feedback to the backend
    console.log(`Feedback for recommendation ${id}: ${isPositive ? 'positive' : 'negative'}`);
  };

  const hasResults = isLoading || error || results.length > 0;

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
    <main className={`flex min-h-screen flex-col ${hasResults ? 'pt-12 pb-20 items-center' : 'items-center justify-center'} p-4 md:p-8 lg:p-12 bg-[#0f0f0f]`}>
      <div className={`w-full max-w-3xl mx-auto ${hasResults ? 'mb-8' : ''} text-center flex flex-col items-center`}>
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
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </div>
      </div>

      {hasResults && (
        <div className="w-full mt-8 max-w-3xl mx-auto">
          <ResultsContainer
            results={results}
            isLoading={isLoading}
            error={error}
            onFeedback={handleFeedback}
          />
        </div>
      )}
    </main>
  );
}
