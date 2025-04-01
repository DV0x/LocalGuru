"use client";

import { FC, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { createPortal } from 'react-dom';

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
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{top: number, left: number} | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Portal setup - we need to make sure we're on the client
  useEffect(() => {
    setIsMounted(true);
    
    // Clean up function
    return () => {
      setIsMounted(false);
    };
  }, []);
  
  // Create a mapping of unique sources
  const sourceMap = new Map<string, number>();
  const uniqueSources: SearchResult[] = [];
  
  searchResults.forEach((result) => {
    // Use URL as the unique identifier for a source
    const sourceId = result.url || result.id;
    if (!sourceMap.has(sourceId)) {
      // Add to our unique sources array and store the mapping
      sourceMap.set(sourceId, uniqueSources.length);
      uniqueSources.push(result);
    }
  });
  
  // Process markdown to make citations interactive
  const processedContent = content?.replace(
    /\[(\d+)\]/g, 
    (match, refNumber) => {
      const originalResult = searchResults[parseInt(refNumber) - 1];
      if (!originalResult) return match;
      
      // Find the unique ID for this source
      const sourceId = originalResult.url || originalResult.id;
      const uniqueIndex = sourceMap.get(sourceId);
      
      if (uniqueIndex !== undefined) {
        return `[${uniqueIndex + 1}](#ref-${uniqueIndex + 1})`;
      }
      
      return match;
    }
  );
  
  // Counter for generating unique IDs
  let citationCounter = 0;
  
  // Create tooltip portal element
  const renderTooltip = () => {
    if (!isMounted || !tooltipPosition || !activeReference) return null;
    
    const refNumber = activeReference;
    const sourceData = uniqueSources[parseInt(refNumber) - 1];
    
    if (!sourceData) return null;
    
    return createPortal(
      <div 
        className="citation-tooltip fixed z-[1000] animate-fadeIn" 
        style={{
          maxWidth: '320px',
          width: 'min(320px, calc(100vw - 40px))',
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
          transform: 'translateX(-50%)'
        }}
        onMouseEnter={(e) => {
          // Keep tooltip visible when hovering it
          e.currentTarget.setAttribute('data-hovered', 'true');
        }}
        onMouseLeave={(e) => {
          e.currentTarget.removeAttribute('data-hovered');
          setTimeout(() => {
            const tooltipEl = document.querySelector('.citation-tooltip[data-hovered="true"]');
            if (!tooltipEl) {
              setActiveCitationId(null);
              setActiveReference(null);
              setTooltipPosition(null);
            }
          }, 100);
        }}
      >
        <div className="relative">
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-zinc-800 rotate-45 border border-zinc-700"></div>
          <div className="relative p-3 bg-zinc-800 text-white rounded-md shadow-md border border-zinc-700">
            <div className="font-medium text-white text-sm mb-2">
              {sourceData.title}
            </div>
            {sourceData.subreddit && (
              <div className="text-zinc-400 text-xs mb-2">
                {sourceData.subreddit}
              </div>
            )}
            <div className="text-zinc-300 text-xs mb-2">
              {sourceData.snippet}
            </div>
            {sourceData.url && (
              <a 
                href={sourceData.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-400 text-xs hover:underline inline-flex items-center"
              >
                View source
                <svg className="w-3 h-3 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  };
  
  return (
    <div className="relative markdown-renderer">
      <ReactMarkdown
        components={{
          h1: ({ node, ...props }) => (
            <h1 {...props} className="text-2xl font-bold text-zinc-100 mb-6" />
          ),
          h2: ({ node, ...props }) => (
            <h2 {...props} className="text-xl font-bold text-zinc-100 mt-8 mb-4" />
          ),
          h3: ({ node, ...props }) => (
            <h3 {...props} className="text-lg font-semibold text-zinc-100 mt-6 mb-3" />
          ),
          p: ({ node, ...props }) => (
            <p {...props} className="text-zinc-200 mb-5 leading-relaxed" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc pl-5 mb-5 text-zinc-200 space-y-2" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal pl-5 mb-5 text-zinc-200 space-y-2" />
          ),
          li: ({ node, ...props }) => (
            <li {...props} className="mb-2 text-zinc-200" />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote {...props} className="border-l-4 border-indigo-500 pl-4 italic my-4 text-zinc-300" />
          ),
          a: ({ node, ...props }) => {
            if (props.href?.startsWith('#ref-')) {
              const refNumber = props.href.replace('#ref-', '');
              const uniqueId = `citation-${refNumber}-${citationCounter++}`;
              
              return (
                <span className="citation-wrapper relative inline-block">
                  <a
                    {...props}
                    className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors cursor-pointer"
                    data-citation-id={uniqueId}
                    onClick={(e) => {
                      e.preventDefault();
                      if (activeCitationId === uniqueId) {
                        setActiveCitationId(null);
                        setActiveReference(null);
                        setTooltipPosition(null);
                      } else {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setActiveCitationId(uniqueId);
                        setActiveReference(refNumber);
                        setTooltipPosition({
                          top: rect.bottom + window.scrollY,
                          left: rect.left + rect.width / 2 + window.scrollX
                        });
                      }
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setActiveCitationId(uniqueId);
                      setActiveReference(refNumber);
                      setTooltipPosition({
                        top: rect.bottom + window.scrollY,
                        left: rect.left + rect.width / 2 + window.scrollX
                      });
                    }}
                    onMouseLeave={(e) => {
                      setTimeout(() => {
                        const tooltipEl = document.querySelector('.citation-tooltip[data-hovered="true"]');
                        if (!tooltipEl) {
                          setActiveCitationId(null);
                          setActiveReference(null);
                          setTooltipPosition(null);
                        }
                      }, 200);
                    }}
                  >
                    [{props.children}]
                  </a>
                </span>
              );
            }
            return <a {...props} className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors" target="_blank" rel="noopener noreferrer" />;
          }
        }}
      >
        {processedContent || ''}
      </ReactMarkdown>
      
      {/* Render tooltip via portal */}
      {isMounted && activeCitationId && renderTooltip()}
      
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
        
        .markdown-renderer strong {
          color: #e4e4e7;
          font-weight: 600;
        }
        
        .markdown-renderer a {
          color: #a5b4fc;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        
        .markdown-renderer a:hover {
          color: #818cf8;
          text-decoration: underline;
        }
        
        .citation-wrapper {
          position: relative;
          display: inline-block;
          z-index: 50;
        }
        
        .citation-tooltip {
          display: block;
          pointer-events: auto !important;
          overflow: visible;
          cursor: default;
        }
        
        .citation-tooltip a {
          cursor: pointer;
          pointer-events: auto !important;
        }
        
        .markdown-renderer {
          overflow: visible;
        }
        
        .prose {
          overflow: visible;
        }
      `}</style>
    </div>
  );
} 