"use client";

import { useEffect, useState } from 'react';
import { MarkdownRenderer } from './markdown-renderer';
import { StreamingStatus } from '@/app/lib/search/streaming-types';
import { StatusController } from './status-indicators';
import { WarningIndicator } from './status-indicators';

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  url?: string;
  subreddit?: string;
  author?: string;
  created_at?: string;
  index: number;
}

interface StreamingResultsProps {
  content: string;
  searchResults: SearchResult[];
  isLoading: boolean;
  status: StreamingStatus;
  statusMessage: string;
  useUnifiedIndicator?: boolean;
}

export function StreamingResults({
  content,
  searchResults,
  isLoading,
  status,
  statusMessage,
  useUnifiedIndicator = true
}: StreamingResultsProps) {
  // Add state to track whether to show no results warning with a delay
  const [showNoResultsWarning, setShowNoResultsWarning] = useState(false);
  
  // Add console log to debug search results
  useEffect(() => {
    console.log('Streaming Results - searchResults length:', searchResults?.length);
    console.log('Streaming Results - searchResults:', searchResults);
  }, [searchResults]);
  
  // Monitor status changes
  useEffect(() => {
    console.log('StreamingResults - status changed to:', status);
    
    // Extra check for stopped status
    if (status === 'stopped') {
      console.log('StreamingResults detected STOPPED state - should hide content:', content ? 'Yes (content exists)' : 'No (no content)');
    }
  }, [status, content]);
  
  // Control the display of the no results warning
  useEffect(() => {
    let warningTimeout: NodeJS.Timeout | null = null;
    
    // Clear any existing timeout when dependencies change
    if (warningTimeout) clearTimeout(warningTimeout);
    
    if (status === 'generating') {
      // Wait a short delay to let metadata arrive before showing warning
      warningTimeout = setTimeout(() => {
        // Only show warning if we actually have no results after the delay
        setShowNoResultsWarning(searchResults.length === 0);
      }, 500);
    } else {
      // Reset warning for other statuses
      setShowNoResultsWarning(false);
    }
    
    return () => {
      if (warningTimeout) clearTimeout(warningTimeout);
    };
  }, [status, searchResults.length]);
  
  return (
    <div className="w-full mt-8 max-w-4xl mx-auto mb-8">
      <div className="neo-card p-6">
        {content && status !== 'stopped' ? (
          <>
            {status === 'generating' && (
              <div className="border-b border-gray-200 mb-6">
                <StatusController 
                  status={status}
                  statusMessage={statusMessage}
                  resultCount={searchResults.length}
                  useUnifiedIndicator={useUnifiedIndicator}
                />
              </div>
            )}
            
            {showNoResultsWarning && <WarningIndicator />}
            
            <div className="prose prose-lg max-w-none text-black">
                <MarkdownRenderer 
                  content={content}
                  searchResults={searchResults}
                />
            </div>
          </>
        ) : (
          <StatusController 
            status={status}
            statusMessage={statusMessage}
            resultCount={searchResults.length}
            useUnifiedIndicator={useUnifiedIndicator}
          />
        )}
      </div>
    </div>
  );
} 