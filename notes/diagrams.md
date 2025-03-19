
# Implementation File Structure and Architecture Diagram

## File Structure

```
localguru/
├── app/
│   ├── api/
│   │   ├── search/
│   │   │   └── route.ts            # Existing search API endpoint
│   │   ├── streaming-search/       # New streaming endpoint
│   │   │   └── route.ts            # Edge-compatible streaming API
│   │   └── feedback/
│   │       └── route.ts            # Existing feedback API
│   ├── lib/
│   │   ├── search/
│   │   │   ├── query-processor.ts  # Existing search functionality
│   │   │   ├── result-formatter.ts # Existing result formatter
│   │   │   ├── types.ts            # Existing type definitions
│   │   │   └── stream-processor.ts # NEW: Formats results for LLM
│   │   ├── prompts/
│   │   │   └── search-synthesis-prompt.ts # NEW: System prompt for LLM
│   │   ├── supabase/
│   │   │   └── client-server.ts    # Existing Supabase client
│   │   └── utils/
│   │       └── api-response.ts     # Existing API utilities
│   ├── globals.css                 # MODIFIED: Added streaming UI styles
│   ├── layout.tsx                  # Existing layout component
│   └── page.tsx                    # MODIFIED: Updated with AI toggle
├── components/
│   ├── search-bar.tsx              # Existing search bar component
│   ├── results-container.tsx       # Existing results container
│   ├── result-card.tsx             # Existing result card
│   ├── markdown-renderer.tsx       # NEW: Renders markdown with citations
│   └── streaming-results.tsx       # NEW: Displays streaming AI content
├── hooks/
│   └── use-streaming-search.ts     # NEW: Custom hook for AI search
├── public/
│   └── ...                         # Existing static assets
├── supabase/
│   └── ...                         # Existing Supabase configuration
├── .env.local                      # MODIFIED: Added ANTHROPIC_API_KEY
├── package.json                    # MODIFIED: Added AI SDK dependencies
└── ...                             # Other existing files
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENT                                        │
│                                                                                  │
│  ┌─────────────┐     ┌─────────────────┐      ┌─────────────────────────────┐   │
│  │  SearchBar  │────▶│  Main Page      │◀────▶│  Toggle AI Synthesis Button │   │
│  └─────────────┘     │  (app/page.tsx) │      └─────────────────────────────┘   │
│                      └────────┬────────┘                                         │
│                               │                                                  │
│                      ┌────────┴────────┐                                         │
│                      │                  │                                         │
│             ┌────────▼──────┐  ┌───────▼────────┐                                │
│             │ ResultContainer│  │ StreamingResults│                               │
│             │ (Traditional)  │  │ (AI Synthesis)  │                               │
│             └────────────────┘  └───────┬────────┘                                │
│                                         │                                         │
│                                ┌────────▼────────┐                                │
│                                │ MarkdownRenderer │                                │
│                                │ (with citations) │                                │
│                                └─────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                     ▲
                                     │ HTTP/HTTPS
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  SERVER                                          │
│                                                                                  │
│  ┌────────────────────┐      ┌────────────────────────┐                          │
│  │ /api/search        │      │ /api/streaming-search  │                          │
│  │ (Traditional API)  │      │ (Edge Runtime)         │                          │
│  └─────────┬──────────┘      └────────────┬───────────┘                          │
│            │                               │                                      │
│            │                 ┌─────────────▼────────────┐                         │
│            │                 │  search-synthesis-prompt │                         │
│            │                 │  (System Instructions)   │                         │
│            │                 └─────────────┬────────────┘                         │
│            │                               │                                      │
│  ┌─────────▼──────────┐     ┌─────────────▼────────────┐                         │
│  │                    │     │                          │                         │
│  │  query-processor   │────▶│  stream-processor        │                         │
│  │  (Search Logic)    │     │  (Format for LLM)        │                         │
│  │                    │     │                          │                         │
│  └─────────┬──────────┘     └─────────────┬────────────┘                         │
│            │                               │                                      │
│  ┌─────────▼──────────┐                   │                                      │
│  │ Supabase Database  │                   │                                      │
│  │ (with vector search)│                   │                                      │
│  └────────────────────┘                   │                                      │
│                                           │                                      │
└───────────────────────────────────────────┼──────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                EXTERNAL SERVICES                                 │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                            Anthropic Claude API                          │    │
│  │                                                                          │    │
│  │  ┌────────────────┐      ┌───────────────────┐    ┌────────────────┐    │    │
│  │  │ System Prompt  │─────▶│  Content Analysis │───▶│ Response Stream│    │    │
│  │  └────────────────┘      └───────────────────┘    └────────────────┘    │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────┐         ┌───────────────────┐          ┌─────────────────────────┐
│ User Input  │────────▶│ Toggle Selection  │─────────▶│ useStreamingSearch hook │
│ (Query)     │         │ (AI or Traditional)│          │ or Traditional Search   │
└─────────────┘         └───────────────────┘          └────────────┬────────────┘
                                                                     │
                                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  API Request                                     │
└─────────────────────────────────────┬───────────────────────────────────────────┘
                                      │
                   ┌─────────────────┴─────────────────┐
                   │                                   │
     ┌─────────────▼───────────────┐    ┌─────────────▼───────────────┐
     │   Traditional API           │    │   Streaming API (Edge)       │
     │  (/api/search)              │    │  (/api/streaming-search)     │
     └─────────────┬───────────────┘    └─────────────┬───────────────┘
                   │                                   │
     ┌─────────────▼───────────────┐    ┌─────────────▼───────────────┐
     │ performFullSearch()         │    │ performFullSearch()         │ 
     │ - Query Analysis            │    │ - Query Analysis            │
     │ - Generate Embeddings       │    │ - Generate Embeddings       │
     │ - Execute Search            │    │ - Execute Search            │
     └─────────────┬───────────────┘    └─────────────┬───────────────┘
                   │                                   │
     ┌─────────────▼───────────────┐    ┌─────────────▼───────────────┐
     │ Return JSON Response        │    │ Format Results for LLM      │
     │                             │    │ (stream-processor.ts)        │
     └─────────────┬───────────────┘    └─────────────┬───────────────┘
                   │                                   │
                   │                    ┌─────────────▼───────────────┐
                   │                    │ Get System Prompt           │
                   │                    │ (search-synthesis-prompt.ts) │
                   │                    └─────────────┬───────────────┘
                   │                                   │
                   │                    ┌─────────────▼───────────────┐
                   │                    │ Call Anthropic Claude API   │
                   │                    │ via Vercel AI SDK           │
                   │                    └─────────────┬───────────────┘
                   │                                   │
                   │                    ┌─────────────▼───────────────┐
                   │                    │ Stream AI Response          │
                   │                    │ with Search Results Metadata│
                   │                    └─────────────┬───────────────┘
                   │                                   │
     ┌─────────────▼───────────────┐    ┌─────────────▼───────────────┐
     │ ResultsContainer Component  │    │ StreamingResults Component  │
     │ Traditional UI              │    │ AI Synthesis UI             │
     └─────────────────────────────┘    └───────────┬─────────────────┘
                                                    │
                                        ┌───────────▼─────────────────┐
                                        │ MarkdownRenderer Component  │
                                        │ with Interactive Citations  │
                                        └───────────────────────────────┘
```

## Component Relationship

```
┌─────────────────────────────────────────────────────────────────────┐
│ App Page (page.tsx)                                                 │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ SearchBar                                 [AI Toggle Button]   │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ┌───────────────────────────┐    ┌───────────────────────────────┐  │
│ │ ResultsContainer          │    │ StreamingResults              │  │
│ │ (Traditional Mode)        │    │ (AI Synthesis Mode)           │  │
│ │ ┌─────────────────────┐   │    │ ┌─────────────────────────┐   │  │
│ │ │ Result Card         │   │    │ │ Markdown Content        │   │  │
│ │ └─────────────────────┘   │    │ │ ┌───────────────────┐   │   │  │
│ │ ┌─────────────────────┐   │    │ │ │ Citation [1]      │   │   │  │
│ │ │ Result Card         │   │    │ │ └───────────────────┘   │   │  │
│ │ └─────────────────────┘   │    │ └─────────────────────────┘   │  │
│ │ ┌─────────────────────┐   │    │ ┌─────────────────────────┐   │  │
│ │ │ Result Card         │   │    │ │ References Section      │   │  │
│ │ └─────────────────────┘   │    │ │ ┌───────────────────┐   │   │  │
│ └───────────────────────────┘    │ │ │ Reference Item 1  │   │   │  │
│                                   │ │ └───────────────────┘   │   │  │
│                                   │ │ ┌───────────────────┐   │   │  │
│                                   │ │ │ Reference Item 2  │   │   │  │
│                                   │ │ └───────────────────┘   │   │  │
│                                   │ └─────────────────────────┘   │  │
│                                   │ ┌─────────────────────────┐   │  │
│                                   │ │ Citation Preview        │   │  │
│                                   │ │ (Appears on hover)      │   │  │
│                                   │ └─────────────────────────┘   │  │
│                                   └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## User Experience Flow

```
START
  │
  ▼
┌───────────────────┐
│ User loads page   │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ User enters query │
└───────┬───────────┘
        │
        ▼
┌───────────────────────┐      ┌───────────────────────┐
│ Traditional Search    │      │ AI Synthesis Toggle   │
│ (Default)             │◄────▶│ (On/Off)              │
└───────┬───────────────┘      └───────┬───────────────┘
        │                              │
        ▼                              ▼
┌───────────────────┐      ┌──────────────────────────┐
│ Display search    │      │ Show loading indicator   │
│ results           │      │ for streaming            │
└───────┬───────────┘      └──────────┬───────────────┘
        │                             │
        │                             ▼
        │               ┌──────────────────────────────┐
        │               │ Receive and display streamed │
        │               │ tokens progressively         │
        │               └──────────┬───────────────────┘
        │                          │
        │                          ▼
        │               ┌──────────────────────────────┐
        │               │ User hovers/clicks citation  │
        │               └──────────┬───────────────────┘
        │                          │
        │                          ▼
        │               ┌──────────────────────────────┐
        │               │ Show citation preview with   │
        │               │ source information           │
        │               └──────────────────────────────┘
        │
        ▼
┌───────────────────┐
│ User gives        │
│ feedback (opt)    │
└───────────────────┘
```

These diagrams and file structure outline provide a comprehensive overview of the implementation architecture, showing how all components interact to deliver the new streaming AI search functionality while maintaining the existing traditional search capabilities.
