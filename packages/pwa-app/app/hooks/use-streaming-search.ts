"use client";

import { useState, useEffect, useRef } from 'react';
import { StreamingSearchClient } from '../lib/api/search-client';
import { SearchStatus, SearchResult } from '../lib/types/search';

export function useStreamingSearch() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isContentInitialized, setIsContentInitialized] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const clientRef = useRef(new StreamingSearchClient());
  
  const search = async (searchQuery: string, location?: string) => {
    try {
      // Reset state
      setQuery(searchQuery);
      setStatus('searching');
      setResults([]);
      setContent('');
      setError(null);
      setIsContentInitialized(false);
      
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      console.log(`Starting search: ${searchQuery} in ${location}`);
      
      // Create a new abort controller
      abortControllerRef.current = new AbortController();
      
      // Start search using the client POST method
      const stream = await clientRef.current.searchWithPost(searchQuery, { 
        location: location || 'San Francisco',
        timestamp: Date.now().toString()
      }, abortControllerRef.current.signal);
      
      // Set status to streaming as soon as we get a response
      setStatus('streaming');
      
      // Create a reader for the stream
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      
      // Process chunks
      let buffer = '';
      let ignoreContentUntilFirstValidJson = true;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream completed');
            break;
          }
          
          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete lines
          let lineEnd;
          while ((lineEnd = buffer.indexOf('\n')) !== -1) {
            const line = buffer.substring(0, lineEnd).trim();
            buffer = buffer.substring(lineEnd + 1);
            
            // Skip empty lines and keepalive messages
            if (!line || line.startsWith(':')) continue;
            
            // Try to parse as JSON
            try {
              const data = JSON.parse(line);
              
              // First valid JSON found - we can start processing content
              if (ignoreContentUntilFirstValidJson) {
                ignoreContentUntilFirstValidJson = false;
                console.log('First valid JSON received, now processing content');
              }
              
              if (data.type === 'status') {
                console.log('Status update:', data.status);
                setStatus(data.status as SearchStatus);
                
                // When transitioning to streaming, make sure we show partial results immediately
                if (data.status === 'streaming' && !content) {
                  setIsContentInitialized(true);
                }
              } else if (data.type === 'content') {
                console.log('Content update length:', data.content?.length);
                if (!isContentInitialized) {
                  setIsContentInitialized(true);
                }
                
                // Set status to streaming if we receive content (in case status update was missed)
                if (status !== 'streaming') {
                  setStatus('streaming');
                }
                
                // Sanitize content to remove any METADATA that might have slipped through
                let sanitizedContent = data.content;
                if (typeof sanitizedContent === 'string') {
                  // Remove any METADATA: lines or blocks
                  if (sanitizedContent.includes('METADATA:')) {
                    console.warn('Found METADATA in content, sanitizing...');
                    // Extract everything after the last occurrence of METADATA: line
                    const metadataPos = sanitizedContent.lastIndexOf('METADATA:');
                    if (metadataPos !== -1) {
                      const lineEndPos = sanitizedContent.indexOf('\n', metadataPos);
                      if (lineEndPos !== -1) {
                        // Keep only what comes after the METADATA line
                        sanitizedContent = sanitizedContent.substring(0, metadataPos) + 
                                          sanitizedContent.substring(lineEndPos + 1);
                      } else {
                        // If no newline after METADATA, just remove that part to the end
                        sanitizedContent = sanitizedContent.substring(0, metadataPos);
                      }
                    }
                  }
                  
                  // Also clean up any content before the first proper markdown heading or paragraph
                  // This handles cases where metadata might be at the beginning with no identifier
                  const markdownStartRegex = /^(#|[A-Za-z])/m;
                  const match = markdownStartRegex.exec(sanitizedContent);
                  if (match && match.index > 0) {
                    console.log('Removing non-content prefix');
                    sanitizedContent = sanitizedContent.substring(match.index);
                  }
                }
                
                setContent(sanitizedContent || '');
              } else if (data.type === 'results') {
                console.log('Results update:', data.data?.length);
                setResults(data.data);
              } else if (data.type === 'metadata') {
                console.log('Received metadata with', data.searchResults?.length || 0, 'results');
                if (data.searchResults) {
                  setResults(data.searchResults);
                }
              }
            } catch (e) {
              // If we haven't seen a valid JSON yet, skip this line completely
              if (ignoreContentUntilFirstValidJson) {
                console.warn('Skipping non-JSON content before first valid message:', line);
                continue;
              }
              
              console.error('Error parsing JSON:', e, 'Raw line:', line);
              // Don't show any unparsed data in the UI after first valid JSON
              console.warn('Received unparseable line that was not displayed:', line);
            }
          }
        }
      } catch (streamError) {
        console.error('Stream processing error:', streamError);
        // Don't show error for intentional aborts
        if (streamError instanceof DOMException && streamError.name === 'AbortError') {
          console.log('Search was aborted intentionally');
          setStatus('stopped');
        } else {
          setStatus('error');
          setError('Stream processing error: ' + (streamError instanceof Error ? streamError.message : String(streamError)));
        }
      } finally {
        reader.releaseLock();
      }
      
    } catch (err) {
      console.error('Search error:', err);
      // Don't show error messages for intentional aborts
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('Search was aborted intentionally');
        setStatus('stopped');
      } else {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      }
    }
  };
  
  const stopSearch = () => {
    console.log('Stopping search');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setStatus('stopped');
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  return {
    query,
    status,
    results,
    content,
    error,
    search,
    stopSearch,
    isLoading: status === 'searching' || status === 'streaming'
  };
} 