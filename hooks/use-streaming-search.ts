"use client";

import { useState, useEffect, useCallback } from 'react';
import { StreamingStatus, StreamingUpdate } from '@/app/lib/search/streaming-types';

/**
 * Custom hook for managing streaming search functionality
 * Handles API requests, streaming updates, and state management
 */
export function useStreamingSearch(initialQuery = '') {
  // State for managing search
  const [query, setQuery] = useState<string>(initialQuery);
  const [input, setInput] = useState<string>(initialQuery);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for streaming content
  const [content, setContent] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [status, setStatus] = useState<StreamingStatus>('initializing');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [metadata, setMetadata] = useState<any>(null);
  
  /**
   * Execute search with streaming API
   */
  const search = useCallback(async (searchQuery: string, options = {}) => {
    if (!searchQuery.trim()) return;
    
    // Reset state
    setQuery(searchQuery);
    setIsLoading(true);
    setError(null);
    setContent('');
    setStatus('initializing');
    setStatusMessage('');
    setSearchResults([]);
    setMetadata(null);
    
    try {
      // Default options
      const defaultOptions = {
        maxResults: 20,
        includeAnalysis: true,
        skipCache: false,
        promptVersion: 'default'
      };
      
      // Merge with provided options
      const searchOptions = { ...defaultOptions, ...options };
      
      // Call API
      const response = await fetch('/api/streaming-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          ...searchOptions
        })
      });
      
      if (!response.ok || !response.body) {
        throw new Error(response.statusText || 'Failed to stream response');
      }
      
      // Set up stream reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          // Check for metadata
          if (line.startsWith('METADATA:')) {
            const metadataJson = line.substring(9);
            try {
              console.log('Received metadata string:', metadataJson.substring(0, 100) + '...');
              const parsedMetadata = JSON.parse(metadataJson);
              console.log('Parsed metadata:', parsedMetadata);
              console.log('Search results in metadata:', parsedMetadata.searchResults?.length || 0);
              setMetadata(parsedMetadata);
              setSearchResults(parsedMetadata.searchResults || []);
              console.log('Set searchResults state to:', parsedMetadata.searchResults?.length || 0, 'items');
            } catch (e) {
              console.error('Error parsing metadata:', e);
            }
            continue;
          }
          
          try {
            const update = JSON.parse(line) as StreamingUpdate;
            
            if (update.type === 'status') {
              setStatus(update.status);
              if (update.message) {
                setStatusMessage(update.message);
              }
            } else if (update.type === 'content') {
              setContent(update.content);
            }
          } catch (e) {
            console.error('Error parsing stream update:', e);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      console.error('Error with streaming search:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * Handle form submission
   */
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    search(input);
  }, [input, search]);
  
  /**
   * Handle input change
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);
  
  /**
   * Clear the current search results and reset state
   */
  const clearSearch = useCallback(() => {
    setContent('');
    setSearchResults([]);
    setQuery('');
    setInput('');
    setError(null);
    setStatus('initializing');
    setStatusMessage('');
    setMetadata(null);
  }, []);
  
  return {
    // Input state
    query,
    input,
    setInput,
    
    // Content state
    content,
    searchResults,
    
    // Status state
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