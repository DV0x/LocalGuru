"use client";

import { MapPin } from "lucide-react";

interface MapPlaceholderProps {
  location: string;
}

export function MapPlaceholder({ location }: MapPlaceholderProps) {
  return (
    <div className="w-full h-full bg-gradient-to-b from-slate-800 to-slate-900 relative">
      {/* Grid overlay for map effect */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)",
          backgroundSize: "50px 50px"
        }}
      />
      
      {/* Center marker */}
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <MapPin className="h-10 w-10 text-primary animate-bounce" />
        <div className="bg-card/80 backdrop-blur-sm px-3 py-1.5 rounded-full mt-2 text-sm font-medium">
          {location}
        </div>
        <div className="mt-4 text-center max-w-xs bg-card/60 backdrop-blur-sm p-4 rounded-lg">
          <p className="text-sm text-card-foreground/80">
            Map will be integrated with Mapbox in a future update
          </p>
        </div>
      </div>
      
      {/* Location markers */}
      <div className="absolute top-1/4 left-1/3 flex flex-col items-center">
        <div className="w-3 h-3 bg-primary/70 rounded-full"></div>
        <div className="w-8 h-8 bg-primary/20 rounded-full absolute -inset-2.5 animate-ping"></div>
      </div>
      <div className="absolute bottom-1/3 right-1/4 flex flex-col items-center">
        <div className="w-3 h-3 bg-accent/70 rounded-full"></div>
        <div className="w-8 h-8 bg-accent/20 rounded-full absolute -inset-2.5 animate-ping" style={{ animationDelay: "1s" }}></div>
      </div>
      <div className="absolute top-1/2 right-1/3 flex flex-col items-center">
        <div className="w-3 h-3 bg-destructive/70 rounded-full"></div>
        <div className="w-8 h-8 bg-destructive/20 rounded-full absolute -inset-2.5 animate-ping" style={{ animationDelay: "0.5s" }}></div>
      </div>
    </div>
  );
} 