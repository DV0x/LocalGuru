# Reddit Content Embedding Processor

This service processes Reddit posts and comments to generate AI-enhanced metadata and vector embeddings for improved search capabilities.

## Features

- Generates 512-dimension embeddings using OpenAI's text-embedding-3-large model
- Extracts entities, topics, locations, and semantic tags using GPT-4 Turbo
- Builds rich thread context for comments including post content and parent comments
- Processes items in batches from a priority queue
- Supports both title embeddings and context-enhanced embeddings

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Configure environment variables by creating a `.env` file:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   OPENAI_API_KEY=your_openai_api_key
   BATCH_SIZE=10
   LOG_LEVEL=info
   ```

## Usage

### Process Queue

Process a batch of items from the embedding queue:

```
npm run start
```

Or with the CLI:

```
npm run process-queue [batch_size]
```

### Process Single Item

Process a specific post or comment:

```
npm run process-item <content_id> <post|comment>
```

## Testing

Test individual components:

```bash
# Test embedding generation
npm run test-embedding

# Test entity extraction
npm run test-entity

# Test thread context building
npm run test-thread

# Test processing a single item (with verification)
npm run test-process-item <content_id> <post|comment>

# Run all component tests
npm run test-all
```

## Build for Production

```
npm run build
```

This will generate compiled JavaScript files in the `dist` directory.

## Architecture

- **Queue Management**: Handles batched processing with priority ordering
- **Entity Extraction**: Uses GPT-4 Turbo to extract structured metadata
- **Thread Context**: Builds rich context for comments including post content
- **Embedding Generation**: Creates 512-dimension embeddings optimized for HNSW search

## Database Schema

The service works with the following tables:
- `embedding_queue`: Tracks items to be processed
- `content_representations`: Stores generated embeddings
- `reddit_posts` & `reddit_comments`: Source content tables, updated with extracted metadata 