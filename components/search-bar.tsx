"use client";

import { useState } from "react";
import { Mic, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React from "react";

// Add TypeScript declarations for the Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

export function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Auto focus the input on mount
  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query);
    }
  };

  const startVoiceRecognition = async () => {
    // Check if browser supports the Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Your browser doesn't support voice recognition. Please try using a different browser.");
      return;
    }

    try {
      setIsListening(true);
      
      // Using the Web Speech API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      
      recognition.onresult = (event: any) => {
        const speechResult = event.results[0][0].transcript;
        setQuery(speechResult);
        setIsListening(false);
        
        // Automatically submit after voice recognition
        if (speechResult.trim()) {
          onSearch(speechResult);
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.start();
    } catch (error) {
      console.error("Error starting voice recognition:", error);
      setIsListening(false);
      alert("There was an error starting voice recognition. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex items-center">
        <div className="relative flex-1 bg-gradient-to-r from-[#1b1b1d] via-[#202123] to-[#1b1b1d] rounded-2xl border border-[#444654]/30 shadow-[0_0_15px_rgba(138,43,226,0.1)] overflow-hidden hover:border-primary/30 hover:shadow-[0_0_20px_rgba(138,43,226,0.2)] focus-within:border-primary/50 focus-within:shadow-[0_0_25px_rgba(138,43,226,0.3)] transition-all duration-300 backdrop-blur-sm group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ pointerEvents: 'none' }}></div>
          
          {/* Shimmer effect */}
          <div className="absolute -inset-[100%] animate-[shimmer_5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" style={{ pointerEvents: 'none' }}></div>
          
          <Input
            ref={inputRef}
            type="text"
            placeholder="Discover hidden restaurants, activities, local spots..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 bg-transparent text-white h-16 pl-6 pr-16 text-base focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-700 placeholder:opacity-40 focus:placeholder:opacity-30 selection:bg-purple-500/70 selection:text-white transition-all duration-300 pointer-events-auto"
            disabled={isLoading}
            autoFocus
            aria-label="Search query"
            spellCheck="false"
            autoComplete="off"
            onClick={() => inputRef.current?.focus()}
            style={{
              WebkitTextFillColor: 'white',
              caretColor: 'white'
            }}
          />
          
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isLoading ? (
              <div className="h-9 w-9 flex items-center justify-center">
                <div className="relative">
                  <Loader2 className="h-5 w-5 animate-spin text-primary/70" />
                  <div className="absolute inset-0 rounded-full blur-sm bg-primary/10 animate-pulse"></div>
                </div>
              </div>
            ) : (
              <Button 
                type="submit" 
                variant="ghost"
                size="icon"
                disabled={!query.trim() || isLoading}
                className="h-10 w-10 rounded-full bg-primary/20 text-white hover:bg-primary/30 hover:text-white hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all duration-300 relative overflow-hidden group"
                aria-label="Search"
              >
                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-hover:animate-pulse"></div>
                <Send className="h-5 w-5 relative z-10" />
                <span className="sr-only">Search</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
} 