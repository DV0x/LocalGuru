/**
 * Types for streaming search functionality
 */

/**
 * Possible states for the streaming search process
 */
export type StreamingStatus = 
  | 'initializing'   // Initial state when request is received
  | 'searching'      // Executing search against the database
  | 'search_complete' // Search completed, about to generate content
  | 'generating'     // AI is generating the response
  | 'complete'       // Response generation is complete
  | 'stopped'        // Search was manually stopped by the user
  | 'error';         // An error occurred

/**
 * Update containing status information about the streaming process
 */
export interface StreamingStatusUpdate {
  type: 'status';
  status: StreamingStatus;
  message?: string;
  resultCount?: number;
  timestamp?: number;
}

/**
 * Update containing generated content
 */
export interface StreamingContentUpdate {
  type: 'content';
  content: string;
}

/**
 * Union type for all possible streaming updates
 */
export type StreamingUpdate = StreamingStatusUpdate | StreamingContentUpdate;

/**
 * Client-side state for tracking streaming search
 */
export interface StreamingSearchState {
  query: string;
  isLoading: boolean;
  content: string;
  searchResults: any[];
  status: StreamingStatus;
  statusMessage: string;
  error: string | null;
}

/**
 * Metadata included at the end of streaming response
 */
export interface StreamingResponseMetadata {
  searchResults: any[];
  query: string;
  analysis?: any;
  processingTime: number;
  searchTime: number;
  aiProcessingTime: number;
  totalResults: number;
  provider: string;
  model: string;
} 