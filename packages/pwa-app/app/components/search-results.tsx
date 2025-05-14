"use client";

import { SearchStatus, SearchResult } from '../lib/types/search';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResultsProps {
  status: SearchStatus;
  results: SearchResult[];
  content: string;
  error: string | null;
}

export function SearchResults({ status, results, content, error }: SearchResultsProps) {
  // Don't render raw content - only show properly formatted content
  const isContentValid = content && !content.includes('METADATA:') && content.trim() !== '';

  // Loading indicator based on status
  const renderStatusIndicator = () => {
    switch (status) {
      case 'searching':
        return (
          <div className="flex items-center justify-center p-6">
            <div className="animate-pulse text-center">
              <div className="inline-block h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="mt-4 text-sm text-muted-foreground">Searching for insights...</p>
            </div>
          </div>
        );
      case 'streaming':
        return (
          <div className="flex items-center justify-center p-6">
            <div className="animate-pulse text-center">
              <div className="inline-block h-8 w-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="mt-4 text-sm text-muted-foreground">Generating insights...</p>
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="rounded-lg bg-destructive/20 p-4 text-center text-destructive">
            <p>{error || 'An error occurred. Please try again.'}</p>
          </div>
        );
      default:
        return null;
    }
  };
  
  // Render only narrative content
  const renderContent = () => {
    if (!isContentValid) return null;
    
    return (
      <div className="mt-6 space-y-6">
        {/* Narrative content */}
        <div className="prose prose-sm max-w-none bg-background/80 backdrop-blur-sm rounded-lg p-4 shadow-lg">
          {content.split('\n').map((paragraph, i) => (
            paragraph.trim() ? <p key={i}>{paragraph}</p> : <br key={i} />
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="mt-4 w-full overflow-hidden"
      >
        {renderStatusIndicator()}
        {renderContent()}
      </motion.div>
    </AnimatePresence>
  );
} 