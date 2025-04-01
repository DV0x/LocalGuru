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
            <div className="absolute inset-0 rounded-full border-4 border-zinc-700 opacity-20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
            <Search className="h-6 w-6 text-indigo-400" />
          </div>
          <p className="text-zinc-300 mt-4 font-medium">
            {statusMessage || 'Searching for results...'}
          </p>
        </div>
      );
    }
    
    if (status === 'search_complete') {
      return (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-zinc-700 shadow-lg">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <p className="text-zinc-300 mt-4 font-medium">
            {statusMessage || `Found ${searchResults.length} results`}
          </p>
          <p className="text-zinc-400 text-sm mt-2">
            Generating insights...
          </p>
        </div>
      );
    }
    
    if (status === 'generating') {
      return (
        <div className="flex flex-col items-center justify-center py-4 mb-4 bg-zinc-700/50 rounded-lg">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-900/50 mb-3">
            <Sparkles className="h-5 w-5 text-indigo-400" />
          </div>
          <p className="text-indigo-300 font-medium">
            AI is synthesizing insights...
          </p>
          <div className="flex space-x-2 mt-3">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse delay-100"></div>
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse delay-300"></div>
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse delay-500"></div>
          </div>
        </div>
      );
    }
    
    if (status === 'error') {
      return (
        <div className="flex flex-col items-center justify-center py-10 bg-red-900/20 rounded-lg">
          <AlertTriangle className="h-12 w-12 mb-2 text-red-400" />
          <p className="text-red-300 font-medium">{statusMessage || 'Something went wrong'}</p>
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <div className="w-full mt-8 max-w-3xl mx-auto px-4">
      <div className="rounded-2xl border border-zinc-700 bg-zinc-800/90 shadow-xl overflow-hidden backdrop-blur-sm">
        {content ? (
          <>
            {status === 'generating' && (
              <div className="border-b border-zinc-700">
                {renderStatusIndicator()}
              </div>
            )}
            <div className="p-10">
              <div className="prose prose-invert prose-headings:text-zinc-100 prose-p:text-zinc-200 prose-strong:text-zinc-100 prose-li:text-zinc-200 max-w-none">
                <MarkdownRenderer 
                  content={content}
                  searchResults={searchResults}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="p-8">
            {renderStatusIndicator()}
          </div>
        )}
      </div>
    </div>
  );
} 