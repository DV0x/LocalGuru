"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, ChevronDown, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/lib/utils";

export interface LocationSelectorProps {
  onLocationChange?: (location: string) => void;
  initialLocation?: string;
  variant?: "default" | "compact" | "mini";
}

export function LocationSelector({
  onLocationChange,
  initialLocation = "San Francisco, CA",
  variant = "default"
}: LocationSelectorProps) {
  const [location, setLocation] = useState(initialLocation);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // City name for display (without state)
  const cityName = location.split(',')[0].trim();

  // Available and coming soon locations
  const locations = [
    { name: "San Francisco, CA", available: true },
    { name: "New York, NY", available: false },
    { name: "Los Angeles, CA", available: false },
    { name: "Chicago, IL", available: false },
    { name: "Seattle, WA", available: false },
  ];

  // Toggle dropdown
  const toggleDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Toggle dropdown clicked");
    setIsOpen(!isOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    // Only add the listener when the dropdown is open
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle location selection
  const handleLocationSelect = (locationName: string, isAvailable: boolean) => {
    if (!isAvailable) return;
    
    setLocation(locationName);
    setIsOpen(false);
    
    if (onLocationChange) {
      // Extract just the city name to pass back
      const city = locationName.split(',')[0].trim();
      onLocationChange(city);
    }
  };

  // Get button style based on variant
  const getButtonStyle = () => {
    switch(variant) {
      case "compact":
        return "h-8 text-xs px-2";
      case "mini":
        return "h-7 text-xs px-1.5 py-0.5";
      default:
        return "h-9 text-sm px-3";
    }
  };

  return (
    <div className="relative inline-block" style={{ zIndex: 100 }}>
      {/* Location Button */}
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "bg-background border border-input flex items-center gap-1 hover:bg-accent/10 relative z-50 cursor-pointer",
          getButtonStyle(),
          isOpen && "bg-accent/10 border-ring"
        )}
        onClick={toggleDropdown}
      >
        <MapPin className={cn("flex-shrink-0", variant === "mini" ? "h-3 w-3" : "h-4 w-4")} />
        <span className="truncate">{variant === "mini" ? cityName : location}</span>
        <ChevronDown 
          className={cn(
            "flex-shrink-0 transition-transform duration-200",
            variant === "mini" ? "h-3 w-3" : "h-4 w-4",
            isOpen && "rotate-180"
          )} 
        />
      </Button>

      {/* Dropdown - now using fixed positioning for more reliable positioning */}
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="fixed z-[1000] bg-popover border border-input rounded-md shadow-md"
          style={{
            top: buttonRef.current 
              ? buttonRef.current.getBoundingClientRect().bottom + 5 
              : 0,
            left: buttonRef.current 
              ? buttonRef.current.getBoundingClientRect().left 
              : 0,
            width: '220px',
          }}
        >
          <div className="py-1">
            {locations.map((loc) => (
              <button
                key={loc.name}
                className={cn(
                  "w-full px-3 py-2 text-left flex items-center justify-between",
                  loc.available 
                    ? "hover:bg-accent/10 cursor-pointer" 
                    : "opacity-60 cursor-default",
                  location === loc.name && "bg-accent/20 font-medium"
                )}
                onClick={() => handleLocationSelect(loc.name, loc.available)}
                disabled={!loc.available}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{loc.name}</span>
                </div>
                {!loc.available && (
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium ml-1 whitespace-nowrap">
                    Coming Soon
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 