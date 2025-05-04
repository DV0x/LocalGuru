"use client"

import { useState } from "react"
import { MapPin, ChevronDown } from "lucide-react"

interface LocationSelectorProps {
  onLocationChange?: (location: string) => void
  initialLocation?: string
}

export function LocationSelector({ 
  onLocationChange, 
  initialLocation = "San Francisco, CA" 
}: LocationSelectorProps) {
  const [location, setLocation] = useState(initialLocation)
  const [isOpen, setIsOpen] = useState(false)

  const locations = [
    { name: "San Francisco, CA", available: true },
    { name: "New York, NY", available: false },
    { name: "Los Angeles, CA", available: false },
    { name: "Chicago, IL", available: false },
    { name: "Seattle, WA", available: false },
  ]

  return (
    <div className="relative">
      <button
        className="location-pill text-sm py-2 px-3 whitespace-nowrap"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <MapPin size={14} className="flex-shrink-0" />
        <span>San Francisco, CA</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute mt-2 w-48 sm:w-64 right-0 z-10">
          <ul className="neo-card py-1 max-h-60 overflow-auto" role="listbox" aria-label="Select a location">
            {locations.map((loc) => (
              <li
                key={loc.name}
                className={`px-4 py-2 flex justify-between items-center ${
                  loc.available ? "cursor-pointer hover:bg-gray-100" : "cursor-not-allowed opacity-60"
                } ${location === loc.name ? "font-bold" : ""}`}
                onClick={() => {
                  if (loc.available) {
                    setLocation(loc.name)
                    setIsOpen(false)
                    // Notify parent component of location change
                    if (onLocationChange) {
                      // Extract just the city name for compatibility with existing code
                      const cityName = loc.name.split(',')[0]
                      onLocationChange(cityName)
                    }
                  }
                }}
                role="option"
                aria-selected={location === loc.name}
                aria-disabled={!loc.available}
              >
                <span>{loc.name}</span>
                {!loc.available && (
                  <span className="text-xs bg-[rgb(var(--secondary))] text-black px-2 py-0.5 rounded-full font-medium">
                    Coming Soon
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
} 