"use client";

import { useState } from "react";
import { Mic, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Ask about travel tips, hidden gems, local insights..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pr-10 h-12 text-base"
            disabled={isLoading}
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <Button 
          type="submit" 
          disabled={!query.trim() || isLoading}
          className="h-12 px-4"
        >
          <Search className="h-5 w-5" />
          <span className="sr-only">Search</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className={`h-12 px-4 ${isListening ? 'bg-red-100 dark:bg-red-900' : ''}`}
          onClick={startVoiceRecognition}
          disabled={isLoading || isListening}
        >
          <Mic className={`h-5 w-5 ${isListening ? 'text-red-500' : ''}`} />
          <span className="sr-only">Voice Search</span>
        </Button>
      </div>
    </form>
  );
} 