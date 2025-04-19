"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Mic } from "lucide-react";

interface FloatingSearchBarProps {
  onSearch: (query: string) => void;
  visible: boolean;
}

export function FloatingSearchBar({ onSearch, visible }: FloatingSearchBarProps) {
  const [query, setQuery] = useState("");
  const [animation, setAnimation] = useState<"entering" | "exiting" | "idle">("idle");
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle visibility changes with smoother animations
  useEffect(() => {
    if (visible) {
      // Make element visible first, then animate
      setIsVisible(true);
      // Short delay before starting animation
      setTimeout(() => {
        setAnimation("entering");
        setTimeout(() => {
          setAnimation("idle");
          inputRef.current?.focus();
        }, 400);
      }, 10);
    } else {
      setAnimation("exiting");
      // Remove from DOM after animation completes
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 250);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [visible]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
      setQuery("");
    }
  };

  // Handle escape key to clear input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && query) {
        setQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [query]);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-[1000] px-4 w-full max-w-xl will-change-transform will-change-opacity
        ${animation === "entering" ? "animate-fade-in" : ""}
        ${animation === "exiting" ? "animate-fade-out" : ""}`}
    >
      <form 
        ref={formRef}
        onSubmit={handleSubmit} 
        className="floating-search-container neo-card shadow-xl w-full cursor-text"
      >
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            className="search-input pr-24 cursor-text"
            placeholder="Search local spots"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search query"
          />
          
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button type="button" className="p-2 hover:bg-gray-100 rounded-full cursor-pointer" aria-label="Voice search">
              <Mic size={20} />
            </button>

            <button type="submit" className="offset-btn !py-1 !px-4 cursor-pointer" disabled={!query.trim()}>
              <Search size={20} className="mr-1" />
              <span>Search</span>
            </button>
          </div>
        </div>
      </form>
      
      <style jsx global>{`
        @keyframes fadeIn {
          0% { 
            opacity: 0; 
            transform: translate(-50%, 15px);
          }
          100% { 
            opacity: 1; 
            transform: translate(-50%, 0);
          }
        }
        
        @keyframes fadeOut {
          0% { 
            opacity: 1; 
            transform: translate(-50%, 0);
          }
          100% { 
            opacity: 0; 
            transform: translate(-50%, 15px);
          }
        }
        
        .animate-fade-in {
          animation: fadeIn 400ms ease-out forwards;
        }
        
        .animate-fade-out {
          animation: fadeOut 250ms ease-in forwards;
        }
        
        .floating-search-container.neo-card {
          border: 2px solid #000;
          background: #fff;
          box-shadow: 6px 6px 0 0 rgba(0, 0, 0, 0.2);
        }
        
        .will-change-transform {
          will-change: transform;
        }
        
        .will-change-opacity {
          will-change: opacity;
        }
        
        /* Ensure cursor is text type on the search bar */
        .floating-search-container.neo-card,
        .floating-search-container .search-input {
          cursor: text !important;
        }
        
        /* But use pointer cursor for buttons */
        .floating-search-container button {
          cursor: pointer !important;
        }
      `}</style>
    </div>
  );
} 