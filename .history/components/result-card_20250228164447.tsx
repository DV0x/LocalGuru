import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, ExternalLink, ThumbsUp, ThumbsDown } from "lucide-react";

export interface TravelRecommendation {
  id: string;
  title: string;
  location: string;
  description: string;
  tags: string[];
  source?: string;
  sourceUrl?: string;
}

interface ResultCardProps {
  recommendation: TravelRecommendation;
  onFeedback?: (id: string, isPositive: boolean) => void;
}

export function ResultCard({ recommendation, onFeedback }: ResultCardProps) {
  const { id, title, location, description, tags, source, sourceUrl } = recommendation;

  return (
    <Card className="w-full overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription className="flex items-center mt-1">
              <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
              <span>{location}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center border-t pt-4 text-xs text-muted-foreground">
        <div className="flex items-center">
          {source && (
            <div className="flex items-center">
              <span>Source: {source}</span>
              {sourceUrl && (
                <a 
                  href={sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center hover:text-foreground"
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
              className="h-8 w-8 p-0" 
              onClick={() => onFeedback(id, true)}
            >
              <ThumbsUp className="h-4 w-4" />
              <span className="sr-only">Helpful</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0" 
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