# LocalGuru - Travel Insights Search Engine

A Next.js application that leverages Supabase and OpenAI embeddings to provide semantic search capabilities for travel recommendations sourced from Reddit.

## Features

- **Semantic Search**: Uses OpenAI embeddings to find relevant travel recommendations based on user queries.
- **Hybrid Search**: Combines vector similarity search with traditional text search for optimal results.
- **User Feedback System**: Collects and stores user feedback on search results to improve future search quality.
- **Voice Input**: Supports voice input for natural query entry.
- **Secure API Layer**: Server-side API routes protect sensitive credentials and provide rate limiting.

## Architecture

- **Frontend**: Next.js with TypeScript and TailwindCSS
- **Backend**: Supabase database and Edge Functions
- **API Layer**: Next.js API Routes for secure server-side operations
- **Search**: Hybrid search using PostgreSQL's vector extension and `ts_rank` text search
- **Embeddings**: OpenAI for generating vector embeddings
- **Security**: Middleware for rate limiting and security headers

## Getting Started

First, set up your environment variables:

```bash
# Create .env.local file
cp .env.example .env.local
# Fill in the required values
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## API Routes

The application provides the following API routes:

1. **`/api/search`**: Main search endpoint that orchestrates the entire search process
2. **`/api/query-analysis`**: Analyzes user queries to extract intent, entities, and topics
3. **`/api/embeddings`**: Generates vector embeddings for search queries
4. **`/api/feedback`**: Collects user feedback on search results

All API routes are protected by rate limiting and include proper error handling.

## Supabase Setup

This project requires a Supabase project with the following components:

1. **Database Tables**:
   - `reddit_posts`: Stores posts with embeddings
   - `reddit_comments`: Stores comments with embeddings
   - `content_chunks`: Stores chunked content for long posts/comments
   - `embedding_metrics`: Tracks embedding processing metrics
   - `search_feedback`: Stores user feedback on search results

2. **Edge Functions**:
   - `query-analysis`: Analyzes user queries for intent and entities
   - `query-embeddings`: Generates embeddings for search queries
   - `feedback`: Records user feedback on search results
   - `embed`: Processes content for embedding generation
   - `process-queue`: Processes the embedding queue

3. **Vector Extension**:
   - The project uses pgvector for similarity search

## Environment Variables

The following environment variables are required:

```
# Supabase Configuration (Server-side)
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Supabase Configuration (Client-side)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Security Configuration
API_RATE_LIMIT=60 # Requests per minute allowed for API routes

# OpenAI
OPENAI_API_KEY=your-openai-key

# Optional: Direct PostgreSQL connection
DATABASE_URL=your-postgres-connection-string

# Optional: Reddit API (for data collection)
REDDIT_CLIENT_ID=your-reddit-client-id
REDDIT_CLIENT_SECRET=your-reddit-client-secret
REDDIT_USERNAME=your-reddit-username
REDDIT_PASSWORD=your-reddit-password

# Optional: Logging Configuration
LOG_LEVEL=info # debug, info, warn, error
```

## Security Features

The application includes several security features:

1. **Rate Limiting**: Prevents abuse of API endpoints
2. **Security Headers**: Protects against common web vulnerabilities
3. **Server-side API Keys**: Keeps sensitive credentials secure
4. **Error Handling**: Prevents leaking sensitive information in error messages

## Deploying Edge Functions

To deploy the Edge Functions to Supabase, you can use the Supabase dashboard:

1. Navigate to your Supabase project
2. Go to Edge Functions
3. Create a new function with the name matching your function directory
4. Copy the code from the corresponding function in `supabase/functions/`
5. Set the required environment variables
6. Deploy the function

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.io/docs)
- [OpenAI Documentation](https://platform.openai.com/docs)

# LocalGuru Enhanced Intent Detection System

## Overview

This repository contains the implementation of an enhanced intent detection system for LocalGuru, a platform that helps users find relevant local information. The system uses advanced natural language processing techniques to detect user intents and provide more relevant search results.

## Key Features

- **Intent Detection**: Automatically detects user intent from search queries
- **Topic Extraction**: Identifies key topics and locations in user queries
- **Boosted Search Results**: Applies different boosting strategies based on detected intent
- **Multi-Strategy Search**: Combines multiple search strategies for optimal results

## Repository Structure

- **`supabase/migrations/`**: Contains all database migrations for the project
  - `20250313000000_enhanced_intent_search.sql`: The latest migration that implements the enhanced intent detection system
  - Other migrations that set up the database schema and functions

- **`tests/`**: Contains essential test scripts and documentation
  - Test scripts for verifying the intent detection system
  - Deployment scripts for applying migrations
  - Documentation of test results

## Intent Types

The system currently supports the following intent types:

1. **recommendation**: Queries seeking recommendations for places, activities, etc.
2. **information**: Queries seeking factual information
3. **comparison**: Queries comparing multiple options
4. **experience**: Queries about personal experiences
5. **local_events**: Queries about events in a specific location
6. **how_to**: Queries seeking instructions or guidance
7. **discovery**: Queries about discovering new things

## Boosting Strategies

Different boosting strategies are applied based on the detected intent:

- **Location Boosting**: Applied to recommendation and local_events intents
- **Context Enhancement**: Applied to how_to and experience intents
- **Topic Boosting**: Applied to information and discovery intents
- **Comparison Boosting**: Applied to comparison intents

## Getting Started

### Prerequisites

- Supabase account and project
- PostgreSQL client (psql)
- jq for JSON processing

### Deployment

To deploy the enhanced intent detection system:

1. Navigate to the `tests` directory
2. Run the deployment script:
   ```
   ./deploy_enhanced_intent_search.sh
   ```

### Testing

To test the enhanced intent detection system:

1. Navigate to the `tests` directory
2. Run the test scripts:
   ```
   ./test_autodetect_only.sh
   ./test_meetup_query_autodetect.sh
   ```

## Documentation

For detailed test results and analysis, see `tests/intent_detection_summary.md`.

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.
