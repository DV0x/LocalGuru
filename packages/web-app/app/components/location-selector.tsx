"use client"

import { useState, useEffect, useRef } from "react"
import { MapPin, ChevronDown, X } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { createPortal } from "react-dom"
import { LocationSelectorProps } from "@/app/lib/types/search-components"

export function LocationSelector({ 
  onLocationChange, 
  initialLocation = "San Francisco, CA",
  variant = "default"
}: LocationSelectorProps) {
  const [location, setLocation] = useState(initialLocation)
  const [isOpen, setIsOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [buttonRect, setButtonRect] = useState<{ top: number, left: number, bottom: number, right: number, width: number, height: number } | null>(null)

  // Set mounted state on client
  useEffect(() => {
    console.log("Component mounted");
    setIsMounted(true);
    return () => {
      console.log("Component unmounted");
      setIsMounted(false);
      setIsOpen(false); // Ensure dropdown closes when component unmounts
    }
  }, []);

  // Update button position
  const updateButtonPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setButtonRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        bottom: rect.bottom + window.scrollY,
        right: rect.right + window.scrollX,
        width: rect.width,
        height: rect.height
      });
      console.log("Button position updated:", rect);
    } else {
      console.log("Button ref not available");
    }
  };

  // Update position when opening
  useEffect(() => {
    if (isOpen) {
      console.log("Dropdown opened, updating position");
      updateButtonPosition();
      
      // Add event listeners
      window.addEventListener('resize', updateButtonPosition);
      window.addEventListener('scroll', updateButtonPosition);
      
      return () => {
        window.removeEventListener('resize', updateButtonPosition);
        window.removeEventListener('scroll', updateButtonPosition);
      };
    }
  }, [isOpen]);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node)
      ) {
        console.log("Click outside detected, closing dropdown");
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log("Escape pressed, closing dropdown");
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const locations = [
    { name: "San Francisco, CA", available: true },
    { name: "New York, NY", available: false },
    { name: "Los Angeles, CA", available: false },
    { name: "Chicago, IL", available: false },
    { name: "Seattle, WA", available: false },
  ];

  // Get just the city name for display
  const shortLocation = location.split(',')[0];

  // Apply styles based on variant with updated colors to match the visual in the image
  let pillClass = "location-pill flex items-center gap-1.5 text-sm py-1.5 px-3 whitespace-nowrap bg-white relative transition-all duration-100 focus:outline-none rounded-full border border-purple-300 bg-white/95 hover:bg-white"; // default
  
  if (variant === "compact") {
    pillClass = "location-pill flex items-center gap-1 text-sm py-1 px-2.5 whitespace-nowrap bg-white relative transition-all duration-100 focus:outline-none rounded-full border border-purple-300 bg-white/95 hover:bg-white";
  } else if (variant === "ultra-compact") {
    pillClass = "location-pill-mini flex items-center gap-1 text-xs py-0.5 px-1.5 whitespace-nowrap relative transition-all duration-100 focus:outline-none rounded-full border border-purple-300 bg-white/95 hover:bg-white";
  }

  // Handle button click without affecting parent elements
  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Button clicked, toggling dropdown");
    setIsOpen(!isOpen);
  };

  // Simpler dropdown rendering without relying on buttonRect initially
  const renderDropdown = () => {
    if (!isMounted || !isOpen) {
      console.log("Not mounted or not open, can't render dropdown");
      return null;
    }

    console.log("Rendering dropdown, button rect:", buttonRect);

    return createPortal(
      <>
        {/* Backdrop overlay */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-[9998]"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
        
        {/* Dropdown panel */}
        <div 
          ref={dropdownRef}
          className="fixed z-[9999] bg-white rounded-md shadow-xl overflow-hidden border border-purple-200"
          style={{
            top: buttonRect ? buttonRect.bottom + 5 : (buttonRef.current ? buttonRef.current.getBoundingClientRect().bottom + window.scrollY + 5 : 0),
            [variant === 'default' ? 'right' : 'left']: buttonRect
              ? (variant === 'default' ? window.innerWidth - buttonRect.right : buttonRect.left)
              : (variant === 'default' ? 20 : 20),
            width: variant === 'default' ? '220px' : '200px'
          }}
        >
          {/* Locations list - no header */}
          <ul 
            className="max-h-48 overflow-y-auto py-1"
            role="listbox" 
            aria-label="Select a location"
          >
            {locations.map((loc) => (
              <li
                key={loc.name}
                className={`
                  relative px-2 py-1.5 transition-colors
                  ${loc.available 
                    ? "cursor-pointer hover:bg-purple-50" 
                    : "cursor-default bg-gray-50"
                  } 
                  ${location === loc.name ? "bg-purple-100" : ""}
                `}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (loc.available) {
                    setLocation(loc.name);
                    setIsOpen(false);
                    // Notify parent component of location change
                    if (onLocationChange) {
                      // Extract just the city name for compatibility with existing code
                      const cityName = loc.name.split(',')[0];
                      onLocationChange(cityName);
                    }
                  }
                }}
                role="option"
                aria-selected={location === loc.name}
                aria-disabled={!loc.available}
              >
                <div className="flex items-center">
                  {location === loc.name && (
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-5 bg-purple-600 rounded-r" />
                  )}
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className={`flex-shrink-0 ${loc.available ? 'text-purple-700' : 'text-gray-400'}`} />
                      <span className={`${location === loc.name ? "font-medium" : "font-normal"} text-sm`}>{loc.name}</span>
                    </div>
                    {!loc.available && (
                      <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-medium ml-1 whitespace-nowrap">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </>,
      document.body
    );
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={`${pillClass} ${isOpen ? 'bg-purple-50 border-purple-400' : ''}`}
        onClick={handleButtonClick}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <MapPin size={variant === "ultra-compact" ? 12 : 14} className="flex-shrink-0 text-purple-700" />
        <span>{variant === "ultra-compact" ? shortLocation : location}</span>
        <ChevronDown 
          size={variant === "ultra-compact" ? 12 : 14} 
          className={`flex-shrink-0 transition-transform duration-200 text-gray-600 ${isOpen ? "rotate-180" : ""}`} 
        />
      </button>
      
      {isOpen && renderDropdown()}
    </div>
  );
} 