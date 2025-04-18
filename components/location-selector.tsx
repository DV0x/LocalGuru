"use client"

import { useState } from "react"
import { MapPin, ChevronDown } from 'lucide-react'

interface LocationSelectorProps {
  initialLocation?: string
  onLocationChange?: (location: string) => void
}

export function LocationSelector({ 
  initialLocation = "San Francisco, CA", 
  onLocationChange 
}: LocationSelectorProps) {
  const [location, setLocation] = useState(initialLocation)
  const [isOpen, setIsOpen] = useState(false)

  // You can customize this list based on your application needs
  const locations = ["San Francisco, CA", "New York, NY", "Los Angeles, CA", "Chicago, IL", "Seattle, WA"]

  const handleLocationChange = (loc: string) => {
    setLocation(loc)
    setIsOpen(false)
    if (onLocationChange) {
      onLocationChange(loc)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="location-pill flex items-center gap-1"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <MapPin size={16} />
        <span>{location}</span>
        <ChevronDown size={14} className={`ml-1 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute mt-2 right-0 z-10">
          <ul className="neo-card py-1" role="listbox">
            {locations.map((loc) => (
              <li
                key={loc}
                className={`px-4 py-2 cursor-pointer hover:bg-gray-100 
                  ${location === loc ? "font-bold" : ""}`}
                onClick={() => handleLocationChange(loc)}
                role="option"
                aria-selected={location === loc}
              >
                {loc}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
} 