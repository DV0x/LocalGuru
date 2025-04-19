"use client"

import { useState } from "react";
import { MapPin, ExternalLink, ThumbsUp, ThumbsDown } from "lucide-react";

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
  const { id, title, location, description, tags, source, sourceUrl, similarity } = recommendation;
  
  // Format description with proper line breaks for display
  const formattedDescription = description.replace(/\\n/g, '\n');
  
  // Calculate similarity percentage
  const rating = similarity !== undefined ? similarity : undefined;

  // Determine category colors using our new vibrant palette
  const getCategoryColor = (category: string) => {
    const categoryMap: Record<string, string> = {
      Restaurant: "bg-[rgb(var(--cat-restaurant))]",
      Bar: "bg-[rgb(var(--cat-bar))]",
      Cafe: "bg-[rgb(var(--cat-cafe))]",
      Outdoors: "bg-[rgb(var(--cat-outdoors))]",
      Shopping: "bg-[rgb(var(--cat-shopping))]",
      Entertainment: "bg-[rgb(var(--cat-entertainment))]",
      "Hidden Gem": "bg-[rgb(var(--cat-hidden-gem))]",
      Food: "bg-[rgb(var(--cat-food))]",
    }

    return categoryMap[category] || "bg-gray-200";
  }

  // Determine text color based on background color
  const getTextColor = (category: string) => {
    const darkTextCategories = ["Cafe", "Outdoors"];
    return darkTextCategories.includes(category) ? "text-black" : "text-white";
  }

  return (
    <div className="result-card">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-bold">{title}</h3>

        {rating && (
          <div className="starburst text-xs">
            <div className="rotate-[-15deg]">
              {Math.round(rating * 100)}%<br />
              MATCH
            </div>
          </div>
          )}
        </div>

      <div className="flex items-center text-sm mb-3">
        <MapPin size={16} className="mr-1" />
        <span>{location}</span>
        </div>
        
      <p className="mb-4 whitespace-pre-line">{formattedDescription}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {tags.map((category) => (
          <span key={category} className={`category-tag ${getCategoryColor(category)} ${getTextColor(category)}`}>
            {category}
          </span>
          ))}
        </div>

      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
        <div className="text-sm">
          {source && (
            <div className="flex items-center">
              <span>Source: {source}</span>
              {sourceUrl && (
                <a 
                  href={sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center hover:underline"
                >
                  <ExternalLink size={14} />
                  <span className="sr-only">Open source link</span>
                </a>
              )}
            </div>
          )}
        </div>

        {onFeedback && (
          <div className="flex items-center gap-2">
            <button 
              className="p-1 hover:bg-gray-100 rounded-full" 
              onClick={() => onFeedback(id, true)}
              aria-label="Helpful"
            >
              <ThumbsUp size={18} />
            </button>
            <button 
              className="p-1 hover:bg-gray-100 rounded-full" 
              onClick={() => onFeedback(id, false)}
              aria-label="Not helpful"
            >
              <ThumbsDown size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 