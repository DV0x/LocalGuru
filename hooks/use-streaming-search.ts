"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { StreamingStatus, StreamingUpdate } from '@/lib/search/streaming-types';

// Define interface for search options
interface SearchOptions {
  maxResults?: number;
  includeAnalysis?: boolean;
  skipCache?: boolean;
  promptVersion?: string;
  defaultLocation?: string;
  vectorWeight?: number;
  textWeight?: number;
  efSearch?: number;
}

/**
 * Custom hook for managing streaming search functionality
 */
export function useStreamingSearch(initialQuery = '') {
  // Basic state
  const [query, setQuery] = useState<string>(initialQuery);
  const [input, setInput] = useState<string>(initialQuery);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [status, setStatus] = useState<StreamingStatus>('initializing');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [metadata, setMetadata] = useState<any>(null);
  
  // Create an id for the current search to track which search is active
  const searchIdRef = useRef<number>(0);
  // Create a ref to store the current abort controller
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);
  
  /**
   * Execute search with streaming API
   */
  const search = useCallback(async (searchQuery: string, options: SearchOptions = {}) => {
    if (!searchQuery.trim()) return;
    
    // Increment the search ID to invalidate any previous searches
    searchIdRef.current += 1;
    const currentSearchId = searchIdRef.current;
    
    // Reset state
    setQuery(searchQuery);
    setIsLoading(true);
    setError(null);
    setContent('');
    setStatus('initializing');
    setStatusMessage('');
    setSearchResults([]);
    setMetadata(null);
    
    // Create abortController for this search
    const abortController = new AbortController();
    // Store the controller in the ref
    abortControllerRef.current = abortController;
    
    try {
      // Default options
      const defaultOptions: SearchOptions = {
        maxResults: 50,
        includeAnalysis: true,
        skipCache: false,
        promptVersion: 'default',
        defaultLocation: undefined,
        vectorWeight: 0.7,
        textWeight: 0.3,
        efSearch: 300
      };
      
      // Merge options
      const searchOptions = { ...defaultOptions, ...options };
      
      // Start fetch request with abort signal
      const response = await fetch('/api/streaming-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          ...searchOptions
        }),
        signal: abortController.signal
      });
      
      if (!response.ok || !response.body) {
        throw new Error(response.statusText || 'Failed to stream response');
      }
      
      // Set up stream reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Process the stream
      while (true) {
        // Check if this search is still the current one
        if (searchIdRef.current !== currentSearchId) {
          // This search has been superseded by a newer one, stop processing
          reader.cancel().catch(() => {});
          break;
        }
        
        // Read from the stream
        const { done, value } = await reader.read();
        
        // Break if done or search is no longer current
        if (done || searchIdRef.current !== currentSearchId) break;
        
        // Decode the chunk
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        // Process each line
        for (const line of lines) {
          // Stop processing if search is no longer current
          if (searchIdRef.current !== currentSearchId) break;
          
          // Process metadata
          if (line.startsWith('METADATA:')) {
            try {
              const metadataJson = line.substring(9);
              const parsedMetadata = JSON.parse(metadataJson);
              
              // Skip if search is no longer current
              if (searchIdRef.current !== currentSearchId) break;
              
              setMetadata(parsedMetadata);
              setSearchResults(parsedMetadata.searchResults || []);
            } catch (e) {
              // Ignore parsing errors
            }
            continue;
          }
          
          // Process regular updates
          try {
            const update = JSON.parse(line) as StreamingUpdate;
            
            // Skip if search is no longer current
            if (searchIdRef.current !== currentSearchId) break;
            
            if (update.type === 'status') {
              setStatus(update.status);
              if (update.message) {
                setStatusMessage(update.message);
              }
            } else if (update.type === 'content') {
              setContent(update.content);
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }
    } catch (err) {
      // Only update error state if this search is still current
      if (searchIdRef.current === currentSearchId && 
          err instanceof Error && 
          err.name !== 'AbortError') {
        setError(err.message || 'An unexpected error occurred');
      }
    } finally {
      // Only update loading state if this search is still current
      if (searchIdRef.current === currentSearchId) {
        setIsLoading(false);
        // Clean up the abort controller reference
        abortControllerRef.current = null;
      }
    }
    
    // Return abort function in case it needs to be called directly
    return () => {
      if (currentSearchId === searchIdRef.current) {
        abortController.abort();
      }
    };
  }, []);
  
  // Handle form submission
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    search(input);
  }, [input, search]);
  
  // Clear search (stop streaming)
  const clearSearch = useCallback(() => {
    console.log('Stopping search and aborting request...');
    // Increment search ID to invalidate current search
    searchIdRef.current += 1;
    
    // Actually abort the ongoing request if there is one
    if (abortControllerRef.current) {
      console.log('AbortController found, calling abort()');
      abortControllerRef.current.abort();
    } else {
      console.log('No AbortController found to abort');
    }
    
    // Update UI immediately to show stopped
    setStatus('stopped');
    console.log('UI state updated: status set to STOPPED');
    setStatusMessage('Search stopped by user');
    setIsLoading(false);
  }, []);
  
  return {
    // State
    query,
    input,
    setInput,
    content,
    searchResults,
    isLoading,
    error,
    status,
    statusMessage,
    metadata,
    
    // Derived state
    isGenerating: status === 'generating',
    isSearching: status === 'searching',
    isComplete: status === 'complete',
    
    // Actions
    handleInputChange,
    handleSubmit,
    search,
    clearSearch
  };
} 