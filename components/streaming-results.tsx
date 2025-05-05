"use client";

import { useEffect } from 'react';
import { MarkdownRenderer } from './markdown-renderer';
import { StreamingStatus } from '@/lib/search/streaming-types';
import { Check, AlertTriangle, Sparkles } from 'lucide-react';

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
}

export function StreamingResults({
  content,
  searchResults,
  isLoading,
  status,
  statusMessage
}: StreamingResultsProps) {
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
  
  // Render status indicators based on current status
  const renderStatusIndicator = () => {
    if (status === 'initializing' || status === 'searching') {
      return (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="inline-block h-12 w-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-bold">{statusMessage || "Searching for local gems..."}</p>
        </div>
      );
    }
    
    if (status === 'search_complete') {
      return (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-[rgb(var(--accent))] mb-4">
            <Check className="h-8 w-8 text-white" />
          </div>
          <p className="font-bold">{statusMessage || `Found ${searchResults.length} results`}</p>
          <p className="text-gray-600 text-sm mt-2">Generating insights...</p>
        </div>
      );
    }
    
    if (status === 'generating') {
      return (
        <div className="flex flex-col items-center justify-center py-4 mb-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[rgb(var(--primary))] mb-3">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <p className="font-bold text-[rgb(var(--primary))]">AI is synthesizing insights...</p>
          <div className="flex space-x-2 mt-3">
            <div className="w-2 h-2 bg-[rgb(var(--primary))] rounded-full animate-pulse delay-100"></div>
            <div className="w-2 h-2 bg-[rgb(var(--accent))] rounded-full animate-pulse delay-300"></div>
            <div className="w-2 h-2 bg-[rgb(var(--secondary))] rounded-full animate-pulse delay-500"></div>
          </div>
        </div>
      );
    }
    
    if (status === 'stopped') {
      return (
        <div className="flex flex-col items-center justify-center py-8 bg-red-50 rounded-lg">
          <div className="bg-red-500 w-10 h-10 flex items-center justify-center rounded-lg mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </div>
          <p className="font-bold text-red-700 mb-1">Search Stopped</p>
          <p className="text-sm text-red-600">{statusMessage || "Search was cancelled by user"}</p>
        </div>
      );
    }
    
    if (status === 'error') {
      return (
        <div className="flex flex-col items-center justify-center py-10 bg-red-50 rounded-lg">
          <AlertTriangle className="h-12 w-12 mb-2 text-red-500" />
          <p className="font-bold text-red-500">{statusMessage || "Something went wrong"}</p>
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <div className="w-full mt-8 max-w-3xl mx-auto mb-8">
      <div className="neo-card p-6">
        {content && status !== 'stopped' ? (
          <>
            {status === 'generating' && <div className="border-b border-gray-200 mb-6">{renderStatusIndicator()}</div>}
            {searchResults.length === 0 && status === 'generating' && (
              <div className="px-4 pt-2 pb-4">
                <div className="flex items-center mb-4 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    No specific matches found in our database. Generating a response based on general knowledge.
                  </p>
                </div>
              </div>
            )}
            <div className="prose prose-lg max-w-none text-black">
                <MarkdownRenderer 
                  content={content}
                  searchResults={searchResults}
                />
            </div>
          </>
        ) : (
          <div>{renderStatusIndicator()}</div>
        )}
      </div>
    </div>
  );
} 