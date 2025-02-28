import { ResultCard, TravelRecommendation } from "@/components/result-card";
import { Loader2 } from "lucide-react";

interface ResultsContainerProps {
  results: TravelRecommendation[];
  isLoading: boolean;
  error?: string;
  onFeedback?: (id: string, isPositive: boolean) => void;
}

export function ResultsContainer({ 
  results, 
  isLoading, 
  error, 
  onFeedback 
}: ResultsContainerProps) {
  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
        <p className="text-gray-400">Searching for the best travel recommendations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12 text-center">
        <div className="bg-red-950/30 text-red-400 p-4 rounded-lg max-w-md border border-red-900/50">
          <p className="font-medium mb-1">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-4 text-white">Travel Recommendations</h2>
      <div className="grid gap-6 md:grid-cols-1">
        {results.map((recommendation) => (
          <ResultCard 
            key={recommendation.id} 
            recommendation={recommendation} 
            onFeedback={onFeedback}
          />
        ))}
      </div>
    </div>
  );
} 