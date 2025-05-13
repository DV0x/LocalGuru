# Parallel Search Edge Function

This Edge Function implements a powerful parallel search capability that combines document-level and chunk-level embeddings for more comprehensive search results.

## How It Works

1. The function receives a search query from the client
2. It generates an embedding for the query using OpenAI's `text-embedding-3-small` model
3. It calls the PostgreSQL `parallel_search` function, passing both the original query and its embedding
4. The database function performs searches in parallel across:
   - Full posts (document-level)
   - Comments (document-level)
   - Content chunks (chunk-level)
5. Results are combined, weighted, and returned to the client

## API Reference

### Request Format

```json
{
  "query": "String: The search query (required)",
  "similarityThresholdDocs": "Number: Minimum similarity for document results (default: 0.65)",
  "similarityThresholdChunks": "Number: Minimum similarity for chunk results (default: 0.7)",
  "docsWeight": "Number: Weight for document-level results (default: 0.8)",
  "maxResults": "Number: Maximum results to return (default: 15)",
  "useTextSearch": "Boolean: Use fallback text search instead of embeddings (default: false)",
  "subreddit": "String: Optional subreddit filter (default: null)"
}
```

### Response Format

```json
{
  "results": [
    {
      "id": "String: Record ID",
      "content_type": "String: 'post' or 'comment'",
      "title": "String: Post title (null for comments)",
      "similarity": "Number: Similarity score",
      "text_preview": "String: Content preview",
      "is_chunk": "Boolean: Whether this is a chunk result",
      "chunk_index": "Number: Chunk index if applicable",
      "parent_title": "String: Parent post title for comments",
      "subreddit": "String: Subreddit name"
    }
  ],
  "searchType": "String: 'semantic' or 'text'",
  "query": "String: Original query",
  "stats": {
    "embeddingTimeMs": "Number: Time to generate embedding",
    "totalTimeMs": "Number: Total search time",
    "resultCount": "Number: Number of results returned"
  }
}
```

## Deployment

1. Create an `.env` file based on `.env.example`
2. Deploy the function using Supabase CLI:

```bash
supabase functions deploy search
```

## Example Usage

### Frontend

```typescript
// Example React/Next.js component using the search function
import { useState } from 'react';
import { supabase } from '@/lib/supabase-client';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('search', {
        body: { query }
      });
      
      if (error) throw error;
      
      setResults(data.results);
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to perform search');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="search-container">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reddit content..."
          className="search-input"
        />
        <button 
          onClick={handleSearch}
          disabled={loading}
          className="search-button"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      
      {error && <div className="error">{error}</div>}
      
      <div className="results">
        {results.map((result) => (
          <div key={`${result.id}-${result.is_chunk ? result.chunk_index : ''}`} className="result-card">
            <div className="result-header">
              <h3>{result.title || (result.is_chunk ? `Chunk ${result.chunk_index}` : 'Comment')}</h3>
              <span className="result-meta">
                {result.subreddit && <span className="subreddit">r/{result.subreddit}</span>}
                <span className="similarity">{(result.similarity * 100).toFixed(1)}% match</span>
              </span>
            </div>
            <p className="result-preview">{result.text_preview}</p>
            {result.is_chunk && <div className="chunk-badge">Content Chunk</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
``` 