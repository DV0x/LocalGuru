export type SearchStatus = 
  | 'idle'
  | 'searching'
  | 'streaming'
  | 'complete'
  | 'error'
  | 'stopped';

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  location?: string;
  url?: string;
  source?: string;
  tags?: string[];
}

export interface StreamingUpdate {
  type: 'status' | 'content' | 'results' | 'metadata';
  data: any;
} 