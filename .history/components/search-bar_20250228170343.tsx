"use client";

import { useState } from "react";
import { Mic, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="relative flex items-center">
        <div className="relative flex-1 bg-[#202123] rounded-xl border border-[#444654]/50 shadow-sm overflow-hidden">
          <Input
            type="text"
            placeholder="Ask about travel tips, hidden gems, local insights..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 bg-transparent text-white h-14 pl-4 pr-20 text-base focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-500"
            disabled={isLoading}
          />
          
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {isLoading ? (
              <div className="h-8 w-8 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-full ${isListening ? 'bg-red-500/20 text-red-500' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                  onClick={startVoiceRecognition}
                  disabled={isLoading || isListening}
                >
                  <Mic className="h-4 w-4" />
                  <span className="sr-only">Voice Search</span>
                </Button>
                
                <Button 
                  type="submit" 
                  variant="ghost"
                  size="icon"
                  disabled={!query.trim() || isLoading}
                  className="h-8 w-8 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Search</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </form>
  );
} 