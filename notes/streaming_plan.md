
# Step-by-Step Implementation Plan: Edge-Based Streaming Search with LLM Processing

## Phase 1: Project Setup (1-2 days)

### Step 1: Install Dependencies
```bash
# Install Vercel AI SDK and providers
npm install ai @ai-sdk/anthropic @ai-sdk/openai

# Install React components for rendering
npm install react-markdown
```

### Step 2: Configure Environment Variables
1. Create or update `.env.local` with LLM API keys and configuration:
```
# LLM API Keys
ANTHROPIC_API_KEY=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
OPENAI_API_KEY=your_openai_key_here

# LLM Configuration
DEFAULT_LLM_PROVIDER=anthropic
DEFAULT_LLM_MODEL=claude-3.7-sonnet
DEFAULT_TEMPERATURE=0.7
```

## Phase 2: LLM Provider Abstraction (1-2 days)

### Step 3: Create LLM Provider Module
1. Create directory structure:
```bash
mkdir -p app/lib/llm
touch app/lib/llm/providers.ts
```

2. Implement the provider abstraction layer:
```typescript
// app/lib/llm/providers.ts
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

export type LLMProvider = 'anthropic' | 'openai';
export type LLMModel = 'claude-3-sonnet' | 'claude-3-opus' | 'claude-3-haiku' | 'gpt-4-turbo' | 'gpt-4o';

export interface LLMConfig {
  model: any; // Model instance from AI SDK
  maxTokens: number;
  temperature: number;
  providerName: string;
  modelName: string;
}

// Get provider configuration
export function getLLMProvider(
  provider: LLMProvider = 'anthropic',
  model: LLMModel = 'claude-3-sonnet',
  temperature: number = 0.7
): LLMConfig {
  // Model mappings
  const modelConfigs: Record<LLMModel, { maxTokens: number, modelId: string }> = {
    'claude-3-sonnet': { maxTokens: 4000, modelId: 'claude-3-sonnet-20240229' },
    'claude-3-opus': { maxTokens: 4000, modelId: 'claude-3-opus-20240229' },
    'claude-3-haiku': { maxTokens: 4000, modelId: 'claude-3-haiku-20240307' },
    'gpt-4-turbo': { maxTokens: 4096, modelId: 'gpt-4-turbo-preview' },
    'gpt-4o': { maxTokens: 4096, modelId: 'gpt-4o' }
  };

  const modelConfig = modelConfigs[model];

  switch (provider) {
    case 'anthropic':
      if (!model.startsWith('claude')) {
        return getLLMProvider('anthropic', 'claude-3-sonnet', temperature);
      }
      return {
        model: anthropic(modelConfig.modelId),
        maxTokens: modelConfig.maxTokens,
        temperature,
        providerName: 'anthropic',
        modelName: model
      };
    case 'openai':
      if (!model.startsWith('gpt')) {
        return getLLMProvider('openai', 'gpt-4-turbo', temperature);
      }
      return {
        model: openai(modelConfig.modelId),
        maxTokens: modelConfig.maxTokens,
        temperature,
        providerName: 'openai',
        modelName: model
      };
    default:
      return getLLMProvider('anthropic', 'claude-3-sonnet', temperature);
  }
}

// Implement fallback strategy
export async function withProviderFallback<T>(
  primaryProvider: LLMProvider,
  primaryModel: LLMModel,
  operation: (config: LLMConfig) => Promise<T>,
  fallbackProvider?: LLMProvider,
  fallbackModel?: LLMModel
): Promise<T> {
  try {
    // Try primary provider
    const config = getLLMProvider(primaryProvider, primaryModel);
    return await operation(config);
  } catch (error) {
    console.error(`Error with primary provider ${primaryProvider}:`, error);
    
    // Try fallback if specified
    if (fallbackProvider) {
      console.log(`Falling back to ${fallbackProvider}...`);
      const fallbackConfig = getLLMProvider(
        fallbackProvider, 
        fallbackModel || (fallbackProvider === 'anthropic' ? 'claude-3-sonnet' : 'gpt-4-turbo')
      );
      return await operation(fallbackConfig);
    }
    
    // Re-throw if no fallback
    throw error;
  }
}
```

## Phase 3: System Prompt Implementation (1 day)

### Step 4: Create System Prompt Module
1. Create prompt directory and file:
```bash
mkdir -p app/lib/prompts
touch app/lib/prompts/search-synthesis-prompt.ts
```

2. Implement the system prompt:
```typescript
// app/lib/prompts/search-synthesis-prompt.ts
export function getSearchSynthesisPrompt(version = 'default') {
  const prompts = {
    default: `You are LocalGuru, an AI assistant that synthesizes search results into helpful, conversational responses.

RESPONSE FORMAT:
- Write in a conversational, helpful tone
- Use markdown formatting for readability
- Structure your response with clear sections and bullet points when appropriate
- Include citations as [1], [2], etc. that correspond to the search results provided
- Use citations after key facts, recommendations, or direct information from search results
- Balance thoroughness with conciseness - be comprehensive but direct

GUIDELINES:
- Start with a brief, direct answer to the query
- Expand with relevant details, organized logically
- Highlight consensus across multiple sources
- Note any contradictions or different perspectives
- End with a brief conclusion or actionable summary
- Include 3-5 citations minimum, more for complex topics
- Do not mention that you're analyzing "search results" - present as direct knowledge

Remember to balance providing accurate information with being helpful and approachable. 
Never make up information not in the search results.`,

    concise: `You are LocalGuru, an AI assistant that gives concise answers based on search results.

RESPONSE FORMAT:
- Write in a direct, efficient tone
- Use markdown formatting for readability
- Include citations as [1], [2], etc.
- Keep responses under 200 words

GUIDELINES:
- Provide the most relevant answer immediately
- Use bullet points for multiple options
- Include only key details
- Only include essential information
- Always cite your sources
- Don't apologize for brevity

Focus on giving the most important information quickly.`,
  };
  
  return prompts[version] || prompts.default;
}
```

## Phase 4: Streaming Types and Processing (1-2 days)

### Step 5: Create Streaming Types
1. Create types file:
```bash
mkdir -p app/lib/search
touch app/lib/search/streaming-types.ts
```

2. Implement streaming types:
```typescript
// app/lib/search/streaming-types.ts
export type StreamingStatus = 
  | 'initializing'
  | 'searching'
  | 'search_complete'
  | 'generating'
  | 'complete'
  | 'error';

export interface StreamingStatusUpdate {
  type: 'status';
  status: StreamingStatus;
  message?: string;
  resultCount?: number;
  timestamp?: number;
}

export interface StreamingContentUpdate {
  type: 'content';
  content: string;
}

export type StreamingUpdate = StreamingStatusUpdate | StreamingContentUpdate;
```

### Step 6: Create Search Results Processor
1. Create processor file:
```bash
touch app/lib/search/stream-processor.ts
```

2. Implement results processor:
```typescript
// app/lib/search/stream-processor.ts
import { SearchResult } from '@/app/lib/supabase/types';

/**
 * Formats search results for LLM consumption
 */
export function formatSearchResultsForLLM(
  results: SearchResult[],
  query: string
): string {
  return `
Query: "${query}"

Search Results:
${results.map((result, index) => `
[Result ${index + 1}]
Title: ${result.title}
Content: ${truncateContent(result.content_snippet || result.content, 300)}
URL: ${result.url || 'N/A'}
Subreddit: ${result.subreddit || 'N/A'}
Author: ${result.author || 'N/A'}
Created: ${formatDate(result.created_at)}
Similarity: ${result.similarity ? Math.round(result.similarity * 100) / 100 : 'N/A'}
${result.metadata ? `Topics: ${JSON.stringify(result.metadata.topics || [])}` : ''}
${result.metadata ? `Locations: ${JSON.stringify(result.metadata.locations || [])}` : ''}
`).join('\n')}

Based on these search results, provide a comprehensive answer to the query.
Use citations like [1], [2], etc. to reference specific results.
`;
}

/**
 * Formats search results for client consumption
 */
export function formatResultForClient(result: SearchResult, index: number) {
  return {
    id: result.id,
    title: result.title,
    snippet: result.content_snippet || truncateContent(result.content, 200),
    url: result.url,
    subreddit: result.subreddit,
    author: result.author,
    created_at: result.created_at,
    index: index + 1 // For citation referencing
  };
}

// Helper functions
function truncateContent(content: string, maxLength: number): string {
  if (!content) return '';
  return content.length > maxLength
    ? content.substring(0, maxLength) + '...'
    : content;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'Unknown date';
  const d = new Date(date);
  return isNaN(d.getTime()) ? 'Invalid date' : d.toLocaleDateString();
}
```

## Phase 5: Edge API Implementation (2-3 days)

### Step 7: Create Streaming Search API
1. Create the API route:
```bash
mkdir -p app/api/streaming-search
touch app/api/streaming-search/route.ts
```

2. Implement edge-compatible streaming API:
```typescript
// app/api/streaming-search/route.ts
import { StreamingTextResponse, streamText } from 'ai';
import { getSearchSynthesisPrompt } from '@/app/lib/prompts/search-synthesis-prompt';
import { performFullSearch } from '@/app/lib/search/query-processor';
import { formatSearchResultsForLLM, formatResultForClient } from '@/app/lib/search/stream-processor';
import { getLLMProvider, withProviderFallback, LLMProvider, LLMModel, LLMConfig } from '@/app/lib/llm/providers';

export const runtime = 'edge';
export const preferredRegion = 'auto';

export async function POST(req: Request) {
  try {
    // Parse request
    const { query, maxResults = 10, skipCache = false } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required and must be a string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Create encoder for text streaming
    const encoder = new TextEncoder();
    
    // Create readable stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial status
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'status', 
            status: 'initializing',
            timestamp: Date.now()
          }) + '\n'));
          
          // Start timing
          const startTime = Date.now();
          
          // Send searching status
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'status', 
            status: 'searching',
            timestamp: Date.now()
          }) + '\n'));
          
          // Execute search
          const searchResponse = await performFullSearch({
            query,
            maxResults: maxResults,
            includeAnalysis: true,
            skipCache: skipCache
          });
          
          // Log search time
          const searchTime = Date.now() - startTime;
          console.log(`Search completed in ${searchTime}ms for query: ${query}`);
          
          // Send search complete status
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'status', 
            status: 'search_complete',
            resultCount: searchResponse.results.length,
            message: `Found ${searchResponse.results.length} results`,
            timestamp: Date.now()
          }) + '\n'));
          
          // Format search results for LLM
          const formattedSearchContent = formatSearchResultsForLLM(
            searchResponse.results,
            query
          );
          
          // Get system prompt
          const systemPrompt = getSearchSynthesisPrompt();
          
          // Send generating status
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'status', 
            status: 'generating',
            message: 'Synthesizing insights from results...',
            timestamp: Date.now()
          }) + '\n'));
          
          // Get LLM configuration
          const defaultProvider = (process.env.DEFAULT_LLM_PROVIDER || 'anthropic') as LLMProvider;
          const defaultModel = (process.env.DEFAULT_LLM_MODEL || 'claude-3-sonnet') as LLMModel;
          
          // Format client results
          const clientResults = searchResponse.results.map(formatResultForClient);
          
          // LLM operation with streaming
          const llmOperation = async (config: LLMConfig) => {
            const llmResponse = await streamText({
              model: config.model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: formattedSearchContent }
              ],
              temperature: config.temperature,
              maxTokens: config.maxTokens
            });
            
            // Process the LLM stream
            const reader = llmResponse.textStream.getReader();
            let accumulatedText = '';
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              accumulatedText += value;
              
              // Send content update
              controller.enqueue(encoder.encode(JSON.stringify({ 
                type: 'content', 
                content: accumulatedText
              }) + '\n'));
            }
            
            // Send complete status
            controller.enqueue(encoder.encode(JSON.stringify({ 
              type: 'status', 
              status: 'complete',
              timestamp: Date.now()
            }) + '\n'));
            
            // Calculate total time
            const totalTime = Date.now() - startTime;
            console.log(`Total request processed in ${totalTime}ms for query: ${query}`);
            console.log(`Search: ${searchTime}ms, AI: ${totalTime - searchTime}ms`);
            
            // Add metadata
            const metadataJson = JSON.stringify({
              searchResults: clientResults,
              query,
              analysis: searchResponse.analysis,
              processingTime: totalTime,
              searchTime,
              aiProcessingTime: totalTime - searchTime,
              totalResults: searchResponse.results.length,
              provider: config.providerName,
              model: config.modelName
            });
            
            // Send metadata
            controller.enqueue(encoder.encode('METADATA:' + metadataJson + '\n'));
            
            // Close stream
            controller.close();
            
            return llmResponse;
          };
          
          // Execute with fallback
          await withProviderFallback(
            defaultProvider,
            defaultModel,
            llmOperation,
            'openai',
            'gpt-4-turbo'
          );
        } catch (error) {
          // Send error status
          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: 'status', 
            status: 'error',
            message: error instanceof Error ? error.message : 'An unexpected error occurred',
            timestamp: Date.now()
          }) + '\n'));
          
          // Close stream
          controller.close();
          
          console.error('Error in streaming search:', error);
        }
      }
    });
    
    // Return streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('Error in streaming search:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred during streaming search',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// CORS handling
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
```

## Phase 6: Frontend Components (3-4 days)

### Step 8: Create Markdown Renderer Component
1. Create component file:
```bash
mkdir -p components
touch components/markdown-renderer.tsx
```

2. Implement markdown renderer:
```typescript
// components/markdown-renderer.tsx
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

export const MarkdownRenderer: FC<MarkdownRendererProps> = ({ 
  content, 
  searchResults 
}) => {
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
          a: ({ node, ...props }) => {
            if (props.href?.startsWith('#ref-')) {
              const refNumber = props.href.replace('#ref-', '');
              return (
                <a
                  {...props}
                  className="inline-flex items-center justify-center px-1.5 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
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
            return <a {...props} target="_blank" rel="noopener noreferrer" />;
          }
        }}
      >
        {processedContent || ''}
      </ReactMarkdown>
      
      {/* Citation preview */}
      {activeReference && searchResults[parseInt(activeReference) - 1] && (
        <div className="citation-preview fixed bottom-24 right-4 max-w-sm p-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl">
          <h4 className="font-bold text-white text-lg mb-2">
            {searchResults[parseInt(activeReference) - 1].title}
          </h4>
          <p className="text-gray-300 text-sm mb-2">
            {searchResults[parseInt(activeReference) - 1].snippet}
          </p>
          {searchResults[parseInt(activeReference) - 1].url && (
            <a 
              href={searchResults[parseInt(activeReference) - 1].url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary text-xs hover:underline"
            >
              View source
            </a>
          )}
        </div>
      )}
    </div>
  );
};
```

### Step 9: Create Streaming Results Component
1. Create component file:
```bash
touch components/streaming-results.tsx
```

2. Implement streaming results component:
```typescript
// components/streaming-results.tsx
import { FC } from 'react';
import { MarkdownRenderer } from './markdown-renderer';
import { StreamingStatus } from '@/app/lib/search/streaming-types';

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

export const StreamingResults: FC<StreamingResultsProps> = ({
  content,
  searchResults,
  isLoading,
  status,
  statusMessage
}) => {
  // Render status indicators based on current status
  const renderStatusIndicator = () => {
    if (status === 'initializing' || status === 'searching') {
      return (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="flex space-x-2 animate-pulse">
            <div className="w-3 h-3 bg-primary rounded-full"></div>
            <div className="w-3 h-3 bg-primary rounded-full"></div>
            <div className="w-3 h-3 bg-primary rounded-full"></div>
          </div>
          <p className="text-zinc-400 mt-4">
            {statusMessage || 'Searching for results...'}
          </p>
        </div>
      );
    }
    
    if (status === 'search_complete') {
      return (
        <div className="flex flex-col items-center justify-center py-10">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
            <svg className="h-6 w-6 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <p className="text-zinc-400 mt-4">
            {statusMessage || `Found ${searchResults.length} results`}
          </p>
          <p className="text-zinc-500 text-sm mt-2">
            Generating insights...
          </p>
        </div>
      );
    }
    
    if (status === 'generating') {
      return (
        <div className="flex flex-col items-center justify-center py-4 mb-4">
          <div className="flex space-x-2 animate-pulse">
            <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
            <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
            <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
          </div>
          <p className="text-amber-400 text-xs mt-2">
            AI is synthesizing insights...
          </p>
        </div>
      );
    }
    
    if (status === 'error') {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-red-500">
          <svg className="h-12 w-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
            </path>
          </svg>
          <p>{statusMessage || 'Something went wrong'}</p>
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <div className="w-full mt-8 max-w-3xl mx-auto">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        {content ? (
          <>
            {status === 'generating' && (
              <div className="mb-4 border-b border-zinc-800 pb-4">
                {renderStatusIndicator()}
              </div>
            )}
            <div className="prose prose-invert max-w-none">
              <MarkdownRenderer 
                content={content}
                searchResults={searchResults}
              />
            </div>
          </>
        ) : (
          renderStatusIndicator()
        )}
      </div>
      
      {/* References section */}
      {searchResults.length > 0 && (
        <div className="mt-6 p-4 rounded-lg border border-zinc-800 bg-zinc-950">
          <h3 className="text-md font-semibold text-zinc-300 mb-2">References</h3>
          <div className="grid gap-3 max-h-48 overflow-y-auto pr-2 text-sm">
            {searchResults.map((result) => (
              <div 
                key={result.id} 
                className="p-2 rounded hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-start">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-xs mr-2 mt-0.5">
                    {result.index}
                  </span>
                  <div>
                    <h4 className="font-medium text-zinc-200">{result.title}</h4>
                    <p className="text-zinc-400 text-xs mt-1">{result.subreddit}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 10: Create Custom Streaming Search Hook
1. Create hooks directory and file:
```bash
mkdir -p hooks
touch hooks/use-streaming-search.ts
```

2. Implement streaming search hook:
```typescript
// hooks/use-streaming-search.ts
import { useState, useEffect, useCallback } from 'react';
import { StreamingStatus, StreamingUpdate } from '@/app/lib/search/streaming-types';

export function useStreamingSearch(initialQuery = '') {
  const [query, setQuery] = useState<string>(initialQuery);
  const [input, setInput] = useState<string>(initialQuery);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [status, setStatus] = useState<StreamingStatus>('initializing');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [metadata, setMetadata] = useState<any>(null);
  
  // Function to search with streaming API
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    // Reset state
    setQuery(searchQuery);
    setIsLoading(true);
    setError(null);
    setContent('');
    setStatus('initializing');
    setStatusMessage('');
    setSearchResults([]);
    setMetadata(null);
    
    try {
      // Call API
      const response = await fetch('/api/streaming-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          maxResults: 10,
          includeAnalysis: true,
          skipCache: false
        })
      });
      
      if (!response.ok || !response.body) {
        throw new Error(response.statusText || 'Failed to stream response');
      }
      
      // Set up stream reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          // Check for metadata
          if (line.startsWith('METADATA:')) {
            const metadataJson = line.substring(9);
            try {
              const parsedMetadata = JSON.parse(metadataJson);
              setMetadata(parsedMetadata);
              setSearchResults(parsedMetadata.searchResults || []);
            } catch (e) {
              console.error('Error parsing metadata:', e);
            }
            continue;
          }
          
          try {
            const update = JSON.parse(line) as StreamingUpdate;
            
            if (update.type === 'status') {
              setStatus(update.status);
              if (update.message) {
                setStatusMessage(update.message);
              }
            } else if (update.type === 'content') {
              setContent(update.content);
            }
          } catch (e) {
            console.error('Error parsing stream update:', e);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      console.error('Error with streaming search:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Handle form submission
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    search(input);
  }, [input, search]);
  
  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);
  
  return {
    query,
    input,
    setInput,
    content,
    handleInputChange,
    handleSubmit,
    search,
    isLoading,
    error,
    searchResults,
    status,
    statusMessage,
    metadata,
    isGenerating: status === 'generating',
    isSearching: status === 'searching',
    isComplete: status === 'complete'
  };
}
```

Let me continue with the remaining steps of the implementation plan:

## Phase 7: Page Integration (continued)

### Step 11: Update Main Page Component (continued)
```typescript
// Continuing the page.tsx implementation
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Discover hidden gems and local insights for your next adventure
        </p>
        
        <div className="w-full px-4 md:px-0 max-w-2xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
            <div className="w-full">
              <SearchBar onSearch={handleSearch} isLoading={useAISynthesis ? isAILoading : isLoading} />
            </div>
            
            <button
              onClick={() => setUseAISynthesis(!useAISynthesis)}
              className={`flex items-center gap-2 py-2 px-4 rounded-md transition-colors ${
                useAISynthesis 
                  ? 'bg-primary/20 text-primary border border-primary/20' 
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
              }`}
            >
              <Sparkles size={16} />
              <span className="text-sm">AI Synthesis</span>
            </button>
          </div>
        </div>
      </div>

      {hasResults && (
        <>
          {useAISynthesis ? (
            // AI Streaming Results
            <StreamingResults
              content={content}
              searchResults={aiSearchResults}
              isLoading={isAILoading}
              status={status}
              statusMessage={statusMessage}
            />
          ) : (
            // Traditional Results
            <div className="w-full mt-8 max-w-3xl mx-auto">
              {results.length > 0 && (
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm text-gray-400">
                    {results.length} results {processingTime !== undefined && `(${processingTime}ms)`}
                    {isCached && <span className="ml-2 text-amber-400">(Cached)</span>}
                  </div>
                  {isCached && (
                    <button 
                      onClick={handleRefresh}
                      className="flex items-center text-sm text-primary hover:text-primary/80 transition-colors"
                      disabled={isLoading}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </button>
                  )}
                </div>
              )}
              <ResultsContainer
                results={results}
                isLoading={isLoading}
                error={error}
                onFeedback={handleFeedback}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
```

### Step 12: Add CSS Styles for Streaming Results
1. Add styles to globals.css or create a custom CSS module:
```css
/* Add to app/globals.css */

/* Markdown renderer styling */
.markdown-renderer {
  font-size: 16px;
  line-height: 1.6;
}

.markdown-renderer h1 {
  font-size: 1.8rem;
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  font-weight: 700;
}

.markdown-renderer h2 {
  font-size: 1.5rem;
  margin-top: 1.4rem;
  margin-bottom: 0.8rem;
  font-weight: 600;
}

.markdown-renderer h3 {
  font-size: 1.3rem;
  margin-top: 1.2rem;
  margin-bottom: 0.7rem;
  font-weight: 600;
}

.markdown-renderer p {
  margin-bottom: 1rem;
}

.markdown-renderer ul {
  list-style-type: disc;
  margin-left: 1.5rem;
  margin-bottom: 1rem;
}

.markdown-renderer ol {
  list-style-type: decimal;
  margin-left: 1.5rem;
  margin-bottom: 1rem;
}

.markdown-renderer li {
  margin-bottom: 0.5rem;
}

.markdown-renderer a.citation-link {
  color: var(--primary);
  text-decoration: none;
  cursor: pointer;
}

.citation-preview {
  z-index: 50;
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## Phase 8: Testing and Deployment (2-3 days)

### Step 13: Local Testing
1. Run the development server:
```bash
npm run dev
```

2. Test functionality with different queries:
   - Simple queries that should return quick results
   - Complex queries requiring synthesis of multiple sources
   - Test toggles between AI and traditional search
   - Verify citation functionality works correctly

3. Test error handling:
   - Invalid queries
   - Empty results handling
   - API failures (can be simulated with network throttling)

### Step 14: Performance Optimization
1. Add logging for performance monitoring:
```typescript
// Add to Edge API route
console.log(`[Performance] Search: ${searchTime}ms, AI: ${aiTime}ms, Total: ${totalTime}ms`);
```

2. Monitor memory usage to check for leaks:
```typescript
// For development only
const memUsage = process.memoryUsage();
console.log(`[Memory] RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
```

3. Implement rate limiting if not already present:
```typescript
// In middleware.ts or similar
const limiter = new RateLimiter({
  tokensPerInterval: 20,
  interval: 'minute',
});

// In API route
const remaining = await limiter.removeTokens(1);
if (remaining < 0) {
  return new Response(
    JSON.stringify({ error: 'Too many requests' }),
    { status: 429, headers: { 'Content-Type': 'application/json' } }
  );
}
```

### Step 15: Deployment Preparation
1. Verify environment variables in production:
```bash
# Add to .env.production
DEFAULT_LLM_PROVIDER=anthropic
DEFAULT_LLM_MODEL=claude-3-sonnet
```

2. Test edge function compatibility:
```bash
npx @vercel/edge-runtime-node --check
```

3. Verify API key configuration in your hosting platform (Vercel, etc.)

### Step 16: Deployment
1. Deploy to Vercel or similar platform:
```bash
vercel deploy
```

2. Configure monitoring for production environment
3. Set up alerts for high usage or errors

## Phase 9: Post-Deployment Refinement (Ongoing)

### Step 17: Prompt Optimization
1. Implement prompt versioning:
```typescript
// app/lib/prompts/search-synthesis-prompt.ts

export function getSearchSynthesisPrompt(version = 'default') {
  // Add more prompt versions for different use cases
  const prompts = {
    default: `You are LocalGuru, an AI assistant...`,
    concise: `You are LocalGuru. Provide very concise answers...`,
    detailed: `You are LocalGuru. Provide comprehensive answers...`
  };
  
  return prompts[version] || prompts.default;
}
```

2. Add A/B testing for prompt versions:
```typescript
// In API route
const promptVersion = Math.random() < 0.5 ? 'default' : 'concise';
const systemPrompt = getSearchSynthesisPrompt(promptVersion);

// Add version to metadata
metadataJson.promptVersion = promptVersion;
```

### Step 18: UX Improvements
1. Add follow-up questions suggestions:
```typescript
// Add to prompt
const followUpPrompt = `
After providing your main answer, suggest 3 follow-up questions related to this query that the user might want to ask next.
Format them as a list with the header "You might also want to ask:"
`;

// Add button component to UI that uses these suggestions
```

2. Add user feedback collection:
```typescript
// Add feedback buttons to UI
<div className="flex justify-center gap-4 mt-6">
  <button onClick={() => handleAIFeedback(true)} className="text-green-500">
    <ThumbsUp className="h-5 w-5" />
  </button>
  <button onClick={() => handleAIFeedback(false)} className="text-red-500">
    <ThumbsDown className="h-5 w-5" />
  </button>
</div>
```

### Step 19: Caching and Scaling Optimizations
1. Implement Redis caching for common queries:
```typescript
// Using Upstash Redis or similar
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});

// Check cache before processing
const cacheKey = `ai:${createHash(query)}`;
const cached = await redis.get(cacheKey);
if (cached) {
  // Return cached result
}

// Store in cache after processing
await redis.set(cacheKey, JSON.stringify(result), { ex: 60 * 60 }); // 1 hour expiry
```

2. Implement precomputation for popular queries:
```typescript
// Background job to precompute common queries
async function precomputePopularQueries() {
  const topQueries = await getTopQueries(20);
  for (const query of topQueries) {
    // Process the query and cache the result
  }
}
```

This complete step-by-step implementation plan covers everything from initial setup through deployment and ongoing refinement. The architecture leverages edge computing for low latency, includes a robust LLM provider abstraction for reliability, and implements streaming progress updates for improved user experience.


