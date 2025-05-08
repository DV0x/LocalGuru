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
        <div className="inline-block h-12 w-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-medium">Searching for local gems...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12 text-center">
        <div className="bg-red-50 text-red-500 p-6 rounded-lg max-w-md border-2 border-black neo-card">
          <p className="font-bold mb-2">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Local Recommendations</h2>
      <div className="grid gap-6">
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