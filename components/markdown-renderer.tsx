"use client";

import { FC, useState } from 'react';
import ReactMarkdown from 'react-markdown';

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

interface MarkdownRendererProps {
  content: string;
  searchResults: SearchResult[];
}

export function MarkdownRenderer({ 
  content, 
  searchResults 
}: MarkdownRendererProps) {
  const [activeReference, setActiveReference] = useState<string | null>(null);
  
  // Process markdown to make citations interactive
  const processedContent = content?.replace(
    /\[(\d+)\]/g, 
    (match, refNumber) => `[${refNumber}](#ref-${refNumber})`
  );
  
  return (
    <div className="relative markdown-renderer">
      <ReactMarkdown
        components={{
          h1: ({ node, ...props }) => (
            <h1 {...props} className="text-2xl font-bold text-zinc-900 dark:text-white mb-4" />
          ),
          h2: ({ node, ...props }) => (
            <h2 {...props} className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mt-6 mb-3" />
          ),
          h3: ({ node, ...props }) => (
            <h3 {...props} className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mt-5 mb-2" />
          ),
          p: ({ node, ...props }) => (
            <p {...props} className="text-zinc-700 dark:text-zinc-300 mb-4 leading-relaxed" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc pl-5 mb-4 text-zinc-700 dark:text-zinc-300" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal pl-5 mb-4 text-zinc-700 dark:text-zinc-300" />
          ),
          li: ({ node, ...props }) => (
            <li {...props} className="mb-1 text-zinc-700 dark:text-zinc-300" />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote {...props} className="border-l-4 border-indigo-300 dark:border-indigo-700 pl-4 italic my-4 text-zinc-600 dark:text-zinc-400" />
          ),
          a: ({ node, ...props }) => {
            if (props.href?.startsWith('#ref-')) {
              const refNumber = props.href.replace('#ref-', '');
              return (
                <a
                  {...props}
                  className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 font-medium text-xs transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveReference(activeReference === refNumber ? null : refNumber);
                  }}
                  onMouseEnter={() => setActiveReference(refNumber)}
                  onMouseLeave={() => setActiveReference(null)}
                >
                  {props.children}
                </a>
              );
            }
            return <a {...props} className="text-indigo-600 dark:text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer" />;
          }
        }}
      >
        {processedContent || ''}
      </ReactMarkdown>
      
      {/* Citation preview */}
      {activeReference && searchResults[parseInt(activeReference) - 1] && (
        <div className="citation-preview fixed bottom-24 right-4 max-w-sm p-5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 animate-fadeIn">
          <div className="absolute top-0 right-0 transform -translate-y-1/2 translate-x-1/2">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-medium border border-white dark:border-zinc-800 shadow-sm">
              {activeReference}
            </span>
          </div>
          <h4 className="font-bold text-zinc-900 dark:text-white text-lg mb-2 pr-6">
            {searchResults[parseInt(activeReference) - 1].title}
          </h4>
          {searchResults[parseInt(activeReference) - 1].subreddit && (
            <p className="text-indigo-600 dark:text-indigo-400 text-xs mb-2 font-medium">
              {searchResults[parseInt(activeReference) - 1].subreddit}
            </p>
          )}
          <p className="text-zinc-700 dark:text-zinc-300 text-sm mb-3 border-l-4 border-indigo-200 dark:border-indigo-700 pl-3 py-1">
            {searchResults[parseInt(activeReference) - 1].snippet}
          </p>
          {searchResults[parseInt(activeReference) - 1].url && (
            <a 
              href={searchResults[parseInt(activeReference) - 1].url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 text-xs hover:underline inline-flex items-center"
            >
              View source
              <svg className="w-3 h-3 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
} 