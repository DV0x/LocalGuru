"use client";

import { useState, useEffect, useRef } from 'react';
import { PerplexitySearchClient } from '../lib/api/perplexity-search-client';
import { SearchStatus, SearchResult } from '../lib/types/search';
import { 
  extractLocationsFromContent, 
  geocodeLocations
} from '../lib/api/perplexity-location-parser';
import { LocationData } from '../lib/api/location-client';
import { useMapContext } from '../contexts/map-context';
import { locationsToFeatures } from '../lib/utils/geojson-utils';

export function usePerplexitySearch() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isContentInitialized, setIsContentInitialized] = useState(false);
  const [extractedLocations, setExtractedLocations] = useState<LocationData[]>([]);
  const [isProcessingLocations, setIsProcessingLocations] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const clientRef = useRef(new PerplexitySearchClient());
  const contentRef = useRef('');
  
  // Get map context for updating features
  const mapContext = useMapContext();
  
  // Process locations extraction and geocoding
  const processLocations = async (contentText: string) => {
    if (!contentText || isProcessingLocations) return;
    
    setIsProcessingLocations(true);
    try {
      // Extract locations from content
      const locations = extractLocationsFromContent(contentText);
      
      if (locations.length > 0) {
        console.log(`Extracted ${locations.length} locations from content`);
        
        // Geocode locations
        const geocoded = await geocodeLocations(locations);
        
        if (geocoded.length > 0) {
          console.log(`Geocoded ${geocoded.length} locations`);
          setExtractedLocations(geocoded);
          
          // Convert to GeoJSON features and update map
          const features = locationsToFeatures(geocoded);
          mapContext.setSearchResultFeatures(features);
          
          // Fit map bounds to show all features
          setTimeout(() => {
            mapContext.fitBoundsToFeatures();
          }, 500);
        }
      }
    } catch (err) {
      console.error('Error processing locations:', err);
    } finally {
      setIsProcessingLocations(false);
    }
  };
  
  const search = async (searchQuery: string, location?: string) => {
    try {
      // Reset state
      setQuery(searchQuery);
      setStatus('searching');
      setResults([]);
      setContent('');
      setExtractedLocations([]);
      setError(null);
      setIsContentInitialized(false);
      contentRef.current = '';
      
      // Clear map features
      mapContext.setSearchResultFeatures([]);
      
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      console.log(`Starting Perplexity search: ${searchQuery} in ${location}`);
      
      // Create a new abort controller
      abortControllerRef.current = new AbortController();
      
      // Start search using the Perplexity client
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
      let locationProcessingTimeout: NodeJS.Timeout | null = null;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream completed');
            
            // Process locations one final time with complete content
            if (contentRef.current) {
              processLocations(contentRef.current);
            }
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
                
                // When complete, process locations one final time
                if (data.status === 'complete' && contentRef.current) {
                  processLocations(contentRef.current);
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
                
                // Store content in state and ref
                setContent(data.content || '');
                contentRef.current = data.content || '';
                
                // Debounce location processing to avoid doing it on every small content update
                if (locationProcessingTimeout) {
                  clearTimeout(locationProcessingTimeout);
                }
                
                locationProcessingTimeout = setTimeout(() => {
                  if (contentRef.current) {
                    processLocations(contentRef.current);
                  }
                }, 1500); // Process locations every 1.5 seconds during streaming
              } else if (data.type === 'results') {
                console.log('Results update:', data.data?.length);
                setResults(data.data);
              }
            } catch (e) {
              // If we haven't seen a valid JSON yet, skip this line completely
              if (ignoreContentUntilFirstValidJson) {
                console.warn('Skipping non-JSON content before first valid message:', line);
                continue;
              }
              
              console.error('Error parsing JSON:', e, 'Raw line:', line);
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
        if (locationProcessingTimeout) {
          clearTimeout(locationProcessingTimeout);
        }
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
    locations: extractedLocations,
    search,
    stopSearch,
    isLoading: status === 'searching' || status === 'streaming',
    isProcessingLocations
  };
} 