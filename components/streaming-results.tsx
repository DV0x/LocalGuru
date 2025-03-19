"use client";

import { FC, useEffect } from 'react';
import { MarkdownRenderer } from './markdown-renderer';
import { StreamingStatus } from '@/app/lib/search/streaming-types';
import { ExternalLink, Check, AlertTriangle, Sparkles, Search, Book } from 'lucide-react';

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
  // Render status indicators based on current status
  const renderStatusIndicator = () => {
    if (status === 'initializing' || status === 'searching') {
      return (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-200 dark:border-indigo-900 opacity-20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
            <Search className="h-6 w-6 text-indigo-500" />
          </div>
          <p className="text-zinc-700 dark:text-zinc-300 mt-4 font-medium">
            {statusMessage || 'Searching for results...'}
          </p>
        </div>
      );
    }
    
    if (status === 'search_complete') {
      return (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-800 shadow-md">
            <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-300" />
          </div>
          <p className="text-zinc-700 dark:text-zinc-300 mt-4 font-medium">
            {statusMessage || `Found ${searchResults.length} results`}
          </p>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-2">
            Generating insights...
          </p>
        </div>
      );
    }
    
    if (status === 'generating') {
      return (
        <div className="flex flex-col items-center justify-center py-4 mb-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-lg">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900 mb-3">
            <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
          </div>
          <p className="text-indigo-700 dark:text-indigo-300 font-medium">
            AI is synthesizing insights...
          </p>
          <div className="flex space-x-2 mt-3">
            <div className="w-2 h-2 bg-indigo-400 dark:bg-indigo-500 rounded-full animate-pulse delay-100"></div>
            <div className="w-2 h-2 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-pulse delay-300"></div>
            <div className="w-2 h-2 bg-indigo-600 dark:bg-indigo-300 rounded-full animate-pulse delay-500"></div>
          </div>
        </div>
      );
    }
    
    if (status === 'error') {
      return (
        <div className="flex flex-col items-center justify-center py-10 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <AlertTriangle className="h-12 w-12 mb-2 text-red-500 dark:text-red-400" />
          <p className="text-red-700 dark:text-red-300 font-medium">{statusMessage || 'Something went wrong'}</p>
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <div className="w-full mt-8 max-w-3xl mx-auto px-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
        {content ? (
          <>
            {status === 'generating' && (
              <div className="border-b border-zinc-200 dark:border-zinc-800">
                {renderStatusIndicator()}
              </div>
            )}
            <div className="p-6">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <MarkdownRenderer 
                  content={content}
                  searchResults={searchResults}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="p-6">
            {renderStatusIndicator()}
          </div>
        )}
      </div>
      
      {/* References section */}
      {searchResults.length > 0 && content && (
        <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md overflow-hidden">
          <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center">
            <Book className="h-4 w-4 mr-2 text-indigo-500" />
            <h3 className="text-md font-semibold text-zinc-800 dark:text-zinc-200">References</h3>
          </div>
          <div className="p-4">
            <div className="grid gap-3 max-h-64 overflow-y-auto pr-2 text-sm">
              {searchResults.map((result) => (
                <div 
                  key={result.id} 
                  className="p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-100 dark:border-zinc-800"
                >
                  <div className="flex items-start">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-medium mr-3 mt-0.5 flex-shrink-0">
                      {result.index}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{result.title}</h4>
                      <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">{result.subreddit}</p>
                    </div>
                    {result.url && (
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-zinc-500 hover:text-indigo-500 dark:text-zinc-400 dark:hover:text-indigo-400 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="View source"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 