'use client';

import React from 'react';
import { MapPin, Heart, Repeat, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import { LocationData } from '../lib/api/location-client';

interface FarcasterLocationCardProps {
  location: LocationData & {
    metadata?: {
      authorName?: string;
      authorUsername?: string;
      authorPfp?: string;
      authorFid?: number;
      isPowerUser?: boolean;
      isTrending?: boolean;
      engagement?: number;
      timestamp?: string;
    };
  };
  onLocationSelect: (location: any, index: number) => void;
  index: number;
  isSelected?: boolean;
}

export function FarcasterLocationCard({ 
  location, 
  onLocationSelect,
  index,
  isSelected = false
}: FarcasterLocationCardProps) {
  const metadata = location.metadata || {};
  
  return (
    <div
      className={cn(
        "p-4 border rounded-lg mb-3 hover:border-primary cursor-pointer transition-all",
        isSelected ? "ring-2 ring-primary" : ""
      )}
      onClick={() => onLocationSelect(location, index)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {metadata.authorPfp && (
            <div className="h-6 w-6 rounded-full overflow-hidden flex-shrink-0">
              <img 
                src={metadata.authorPfp} 
                alt={metadata.authorName || 'User'} 
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <h3 className="font-medium text-sm line-clamp-1">{location.name}</h3>
        </div>
        
        <div className="flex gap-1">
          {metadata.isPowerUser && (
            <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
              Power
            </span>
          )}
          {metadata.isTrending && (
            <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
              Trending
            </span>
          )}
        </div>
      </div>
      
      {location.address && (
        <p className="text-xs text-muted-foreground mb-2 flex items-center">
          <MapPin className="h-3 w-3 mr-1 inline flex-shrink-0" />
          <span className="line-clamp-1">{location.address}</span>
        </p>
      )}
      
      <p className="text-sm line-clamp-3 mb-3 text-foreground/90">
        {location.source_text}
      </p>
      
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {metadata.authorUsername && (
            <span className="text-primary">@{metadata.authorUsername}</span>
          )}
          
          {metadata.engagement !== undefined && metadata.engagement > 0 && (
            <div className="flex gap-2">
              <span className="flex items-center">
                <Heart className="h-3 w-3 mr-1 text-red-500" />
                {Math.floor(metadata.engagement / 2)}
              </span>
              
              <span className="flex items-center">
                <Repeat className="h-3 w-3 mr-1 text-green-500" />
                {Math.floor(metadata.engagement / 3)}
              </span>
            </div>
          )}
        </div>
        
        {metadata.timestamp && (
          <span className="text-xs text-muted-foreground">
            {new Date(metadata.timestamp).toLocaleDateString(undefined, { 
              month: 'short', 
              day: 'numeric' 
            })}
          </span>
        )}
      </div>
      
      <div className="flex gap-2 mt-3">
        <button 
          className="flex-1 h-8 text-xs border rounded flex items-center justify-center hover:bg-muted transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (location.latitude && location.longitude) {
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`,
                '_blank'
              );
            } else {
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.name)}`,
                '_blank'
              );
            }
          }}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1" />
          View on Maps
        </button>
      </div>
    </div>
  );
} 