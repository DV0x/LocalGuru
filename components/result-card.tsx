import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, ExternalLink, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Percent } from "lucide-react";

export interface TravelRecommendation {
  id: string;
  title: string;
  location: string;
  description: string;
  tags: string[];
  source?: string;
  sourceUrl?: string;
  similarity?: number;
  matchType?: string;
}

interface ResultCardProps {
  recommendation: TravelRecommendation;
  onFeedback?: (id: string, isPositive: boolean) => void;
}

export function ResultCard({ recommendation, onFeedback }: ResultCardProps) {
  const { id, title, location, description, tags, source, sourceUrl, similarity, matchType } = recommendation;
  const [expanded, setExpanded] = useState(false);
  
  // Calculate if the description is long enough to warrant collapsing
  const isLongDescription = description.length > 400;
  
  // Format description with proper line breaks for display
  const formattedDescription = description.replace(/\\n/g, '\n');
  
  // Display the full description if expanded, otherwise show a preview
  const displayDescription = !isLongDescription || expanded 
    ? formattedDescription 
    : `${formattedDescription.substring(0, 400)}...`;

  // Format similarity score as percentage if available
  const similarityPercent = similarity !== undefined 
    ? `${Math.round(similarity * 100)}%` 
    : undefined;

  return (
    <Card className="w-full overflow-hidden transition-all hover:shadow-md bg-[#202123] border-[#444654]/50 text-white">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl text-white">{title}</CardTitle>
            <CardDescription className="flex items-center mt-1 text-gray-400">
              <MapPin className="h-4 w-4 mr-1" />
              <span>{location}</span>
            </CardDescription>
          </div>
          {similarityPercent && (
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              <Percent className="h-3 w-3 mr-1" />
              {similarityPercent}
            </Badge>
          )}
        </div>
        {matchType && (
          <Badge variant="secondary" className="text-xs mt-1 bg-gray-800/50">
            {matchType.replace('_', ' ')}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-sm text-gray-400 whitespace-pre-line">{displayDescription}</p>
          
          {isLongDescription && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-1 text-xs text-primary p-0 h-auto hover:bg-transparent hover:text-primary/80"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3 mr-1" /> Show less</>
              ) : (
                <><ChevronDown className="h-3 w-3 mr-1" /> Read more</>
              )}
            </Button>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 mt-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs bg-gray-800 text-gray-300 hover:bg-gray-700">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center border-t border-[#444654]/50 pt-4 text-xs text-gray-400">
        <div className="flex items-center">
          {source && (
            <div className="flex items-center">
              <span>Source: {source}</span>
              {sourceUrl && (
                <a 
                  href={sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center hover:text-gray-300"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span className="sr-only">Open source link</span>
                </a>
              )}
            </div>
          )}
        </div>
        {onFeedback && (
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-0 h-6 w-6 rounded-full hover:bg-green-900/20 hover:text-green-400"
              onClick={() => onFeedback(id, true)}
            >
              <ThumbsUp className="h-4 w-4" />
              <span className="sr-only">Helpful</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-0 h-6 w-6 rounded-full hover:bg-red-900/20 hover:text-red-400"
              onClick={() => onFeedback(id, false)}
            >
              <ThumbsDown className="h-4 w-4" />
              <span className="sr-only">Not helpful</span>
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
} 