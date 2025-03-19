"use client";

import { useState } from "react";
import { SearchBar } from "@/components/search-bar";
import { analyzeQuery } from "../../../src/lib/api/query-analysis";
import { Compass } from "lucide-react";

interface QueryResult {
  id: string;
  entities: Record<string, string[]>;
  topics: string[];
  locations: string[];
  intent: string;
  enhancedQueries: string[];
}

export default function TestQueryAnalysis() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await analyzeQuery(query);
      setQueryResult(result);
    } catch (err) {
      console.error("Error analyzing query:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8 lg:p-12 bg-[#0f0f0f]">
      <div className="w-full max-w-3xl mx-auto mb-8 text-center flex flex-col items-center">
        <div className="flex justify-center mb-6">
          <div className="bg-primary/10 p-3 rounded-full">
            <Compass className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3 text-white">Query Analysis Test</h1>
        <p className="text-gray-400 mb-10 max-w-md mx-auto">
          Test the query analysis edge function by entering a search query
        </p>
        
        <div className="w-full px-4 md:px-0 max-w-2xl mx-auto">
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </div>
      </div>

      {error && (
        <div className="w-full max-w-3xl mx-auto mt-8 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500">
          <h3 className="font-semibold mb-2">Error</h3>
          <p>{error}</p>
        </div>
      )}

      {queryResult && (
        <div className="w-full max-w-3xl mx-auto mt-8 p-6 bg-[#202123] border border-[#444654]/50 rounded-lg text-white">
          <h2 className="text-xl font-bold mb-4">Query Analysis Result</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary">Intent</h3>
              <div className="py-2 px-4 bg-[#151618] rounded-md">
                <span className="font-mono">{queryResult.intent}</span>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary">Topics</h3>
              {queryResult.topics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {queryResult.topics.map((topic, i) => (
                    <span key={i} className="py-1 px-3 bg-[#151618] rounded-full text-sm">
                      {topic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No topics detected</p>
              )}
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary">Locations</h3>
              {queryResult.locations.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {queryResult.locations.map((location, i) => (
                    <span key={i} className="py-1 px-3 bg-[#151618] rounded-full text-sm">
                      {location}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No locations detected</p>
              )}
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary">Entities</h3>
              {Object.keys(queryResult.entities).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(queryResult.entities).map(([type, entities]) => (
                    <div key={type} className="py-2 px-4 bg-[#151618] rounded-md">
                      <span className="font-semibold text-gray-300">{type}: </span>
                      <span>{entities.join(', ')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No entities detected</p>
              )}
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary">Enhanced Queries</h3>
              {queryResult.enhancedQueries.length > 0 ? (
                <ul className="space-y-2">
                  {queryResult.enhancedQueries.map((query, i) => (
                    <li key={i} className="py-2 px-4 bg-[#151618] rounded-md">
                      {query}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400">No enhanced queries generated</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 