"use client";

import { FC, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { createPortal } from 'react-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

// Type for code component props
interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  node?: any;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}

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
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  
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
        // Use standard markdown link format which ReactMarkdown will properly handle
        return `[${refNumber}](#source-${refNumber})`;
      }
      
      return match;
    }
  );
  
  // Don't automatically add sources - we'll add them manually
  const contentWithoutSources = processedContent || '';
  
  // Function to check if the content has citations
  const hasCitations = () => {
    return (/\[\d+\]/).test(contentWithoutSources);
  };
  
  // Counter for generating unique IDs
  let citationCounter = 0;
  
  // Create tooltip portal element
  const renderTooltip = () => {
    if (!isMounted || !tooltipPosition || !activeReference) return null;
    
    const refNumber = activeReference;
    const sourceData = searchResults[parseInt(refNumber) - 1];
    
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
            <div className="flex items-center mt-3 pt-2 border-t border-zinc-700">
              {sourceData.url ? (
                <span className="text-zinc-400 text-xs italic">Click citation to open source</span>
              ) : (
                <span className="text-zinc-400 text-xs italic">Source has no URL</span>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };
  
  // Only keep the isMounted effect
  useEffect(() => {
    setIsMounted(true);
    
    // Clean up function
    return () => {
      setIsMounted(false);
    };
  }, []);
  
  // Render sources component separately
  const renderSourcesSection = () => {
    if (!searchResults.length) return null;
    
    return (
      <div className="sources-container mt-8">
        <button 
          onClick={() => setIsSourcesOpen(!isSourcesOpen)}
          className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors w-full justify-between border-t pt-3"
        >
          <span>Sources ({searchResults.length})</span>
          {isSourcesOpen ? 
            <ChevronUp size={16} className="ml-2" /> : 
            <ChevronDown size={16} className="ml-2" />
          }
        </button>
        
        {isSourcesOpen && (
          <div className="mt-3 grid gap-2 text-sm">
            {searchResults.map((result, index) => {
              const sourceUrl = result.url || "#";
              const sourceTitle = result.title || `Source ${index + 1}`;
              const domain = result.url ? new URL(result.url).hostname.replace(/^www\./, '') : "";
              
              return (
                <div key={`source-${index + 1}`} id={`source-${index + 1}`} className="source-item">
                  <div className="flex items-start space-x-2">
                    <span className="font-medium text-xs bg-indigo-100 text-indigo-800 rounded-full h-5 min-w-5 flex items-center justify-center px-1">{index + 1}</span>
                    <div className="flex-1 leading-tight">
                      <a 
                        href={sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-medium text-indigo-600 hover:underline flex items-center"
                      >
                        {sourceTitle.length > 60 ? sourceTitle.substring(0, 60) + '...' : sourceTitle}
                        <ExternalLink size={12} className="ml-1 inline-block flex-shrink-0" />
                      </a>
                      {domain && <div className="text-xs text-gray-500">{domain}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="relative markdown-renderer">
      <ReactMarkdown
        components={{
          h1: ({ node, ...props }) => (
            <h1 {...props} className="text-2xl font-bold text-black mb-6" />
          ),
          h2: ({ node, ...props }) => (
            <h2 {...props} className="text-xl font-bold text-black mt-8 mb-4" />
          ),
          h3: ({ node, ...props }) => (
            <h3 {...props} className="text-lg font-semibold text-black mt-6 mb-3" />
          ),
          p: ({ node, ...props }) => (
            <p {...props} className="text-black mb-5 leading-relaxed" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className="list-disc pl-5 mb-5 text-black space-y-2" />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className="list-decimal pl-5 mb-5 text-black space-y-2" />
          ),
          li: ({ node, ...props }) => (
            <li {...props} className="mb-2 text-black" />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote {...props} className="border-l-4 border-indigo-500 pl-4 italic my-4 text-black" />
          ),
          a: ({ node, ...props }) => {
            // Handle citation links
            if (props.href?.startsWith('#source-')) {
              const refNumber = props.href.replace('#source-', '');
              const sourceResult = searchResults[parseInt(refNumber) - 1];
              const sourceUrl = sourceResult?.url || "#";
              
              return (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="citation-link"
                  onClick={(e) => {
                    // Only prevent navigation if there's no URL
                    if (!sourceResult?.url || sourceUrl === "#") {
                      e.preventDefault(); // Prevent navigation if no URL
                      console.log('Citation clicked but no URL available');
                    } else {
                      console.log('Citation redirecting to:', sourceUrl);
                      // Let the default behavior happen (navigation to URL)
                    }
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setActiveCitationId(`citation-${refNumber}`);
                    setActiveReference(refNumber);
                    setTooltipPosition({
                      top: rect.bottom + window.scrollY + 10,
                      left: rect.left + window.scrollX + (rect.width / 2)
                    });
                  }}
                  onMouseLeave={() => {
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
                  {props.children}
                </a>
              );
            }
            
            // External source links in the Sources section
            if (props.href && !props.href.startsWith('#')) {
              return (
                <a
                  {...props}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link"
                />
              );
            }
            
            // Default link handling
            return (
              <a
                {...props}
                className="font-medium text-indigo-600 hover:text-indigo-800 underline"
              />
            );
          },
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || "");
            return !inline ? (
              <SyntaxHighlighter
                {...props}
                PreTag="div"
                children={String(children).replace(/\n$/, "")}
                language={match ? match[1] : "javascript"}
                style={dark}
                className="rounded-md"
              />
            ) : (
              <code
                {...props}
                className="bg-gray-100 rounded px-1 py-0.5 text-gray-800 font-mono text-sm"
              >
                {children}
              </code>
            );
          }
        }}
        remarkPlugins={[]}
        rehypePlugins={[]}
      >
        {contentWithoutSources}
      </ReactMarkdown>
      
      {/* Add sources section only if there are citations */}
      {hasCitations() && renderSourcesSection()}
      
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
          color: #000000;
          font-weight: 600;
        }
        
        .markdown-renderer a {
          color: #4f46e5;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        
        .markdown-renderer a:hover {
          color: #4338ca;
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
        
        /* Sources section styling */
        .sources-container {
          border-top: 1px solid #e5e7eb;
        }
        
        .source-item {
          padding: 4px 0;
        }
        
        /* Improved citation link style */
        .citation-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #4f46e5;
          font-size: 0.75rem;
          font-weight: 500;
          text-decoration: none !important;
          cursor: pointer;
          position: relative;
          z-index: 10;
          background-color: #eef2ff;
          border-radius: 9999px;
          padding: 0 4px;
          min-width: 16px;
          height: 16px;
          margin: 0 1px;
          vertical-align: text-top;
          line-height: 1;
        }
        
        .citation-link:hover {
          background-color: #e0e7ff;
          text-decoration: none !important;
        }
      `}</style>
    </div>
  );
} 