"use client";

import { ReactNode } from 'react';
import { StreamingStatus } from '@/app/lib/search/streaming-types';
import { SearchingIndicator } from './searching-indicator';
import { GeneratingIndicator } from './generating-indicator';
import { CompleteIndicator } from './complete-indicator';
import { ErrorIndicator } from './error-indicator';
import { StoppedIndicator } from './stopped-indicator';
import { WarningIndicator } from './warning-indicator';
import { UnifiedIndicator } from './unified-indicator';

// Re-export all indicator components
export { 
  SearchingIndicator,
  GeneratingIndicator,
  CompleteIndicator,
  ErrorIndicator,
  StoppedIndicator,
  WarningIndicator,
  UnifiedIndicator
};

interface StatusControllerProps {
  status: StreamingStatus;
  statusMessage?: string;
  resultCount?: number;
  showSearchComplete?: boolean;
  className?: string;
  children?: ReactNode;
  useUnifiedIndicator?: boolean;
}

/**
 * A controller component that renders the appropriate status indicator based on the current status
 */
export function StatusController({
  status,
  statusMessage,
  resultCount,
  showSearchComplete = true,
  className = "",
  children,
  useUnifiedIndicator = false
}: StatusControllerProps) {
  // Use the unified indicator if enabled
  if (useUnifiedIndicator) {
    if (status === 'initializing' || status === 'searching') {
      return (
        <UnifiedIndicator 
          phase="searching"
          customMessage={statusMessage}
          className={className}
        />
      );
    }
    
    if (status === 'generating') {
      return (
        <UnifiedIndicator 
          phase="generating"
          customMessage={statusMessage}
          className={className}
        />
      );
    }
  }
  
  // Otherwise, fall back to the original individual indicators
  if (status === 'initializing' || status === 'searching') {
    return (
      <SearchingIndicator 
        message={statusMessage || "Searching for local gems..."}
        className={className}
      />
    );
  }
  
  if (status === 'search_complete' && showSearchComplete) {
    return (
      <CompleteIndicator 
        message={statusMessage}
        resultCount={resultCount}
        className={className}
      />
    );
  }
  
  if (status === 'generating') {
    return (
      <GeneratingIndicator 
        message={statusMessage || "AI is synthesizing insights..."}
        className={className}
      />
    );
  }
  
  if (status === 'stopped') {
    return (
      <StoppedIndicator 
        message={statusMessage || "Search Stopped"}
        detailedMessage={statusMessage ? undefined : "Search was cancelled by user"}
        className={className}
      />
    );
  }
  
  if (status === 'error') {
    return (
      <ErrorIndicator 
        message={statusMessage || "Something went wrong"}
        className={className}
      />
    );
  }
  
  // If no status matches or status is 'complete', render children or null
  return children ? <>{children}</> : null;
} 