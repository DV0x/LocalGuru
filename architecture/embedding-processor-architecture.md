# Embedding Processor Architecture

## Overview

The Embedding Processor is a standalone Node.js service that generates vector embeddings for content in the LocalGuru application. It processes content from the database, computes embeddings using AI models, and stores the results back in the database for semantic search.

## Directory Structure

```
embedding-processor/
├── src/
│   ├── processors/    # Different processor implementations
│   ├── services/      # External service integrations
│   ├── sql/           # SQL queries and database interactions
│   ├── cli.ts         # Command-line interface
│   └── index.ts       # Entry point
├── scripts/           # Utility scripts
└── node_modules/      # Dependencies
```

## Key Components

### Core Components

1. **Content Processors**
   - Process different types of content (posts, comments)
   - Extract text and metadata
   - Generate vector embeddings

2. **Embedding Service**
   - Integrates with AI models for embedding generation
   - Handles rate limiting and error recovery
   - Optimizes batch processing

3. **Database Service**
   - Manages connections to the Supabase database
   - Handles transaction management
   - Updates content with generated embeddings

4. **Queue Processor**
   - Processes items from embedding queue
   - Manages concurrent processing
   - Implements backoff strategies for failures

### Workflow Process

1. **Content Detection**
   - Identifies new or updated content in the database
   - Adds items to embedding queue for processing

2. **Content Preparation**
   - Extracts and cleans text content
   - Generates context information for embedding

3. **Embedding Generation**
   - Sends content to AI model for embedding
   - Receives vector representations

4. **Storage**
   - Stores embeddings in the database
   - Updates content status and metadata
   - Records processing metrics

## Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                      Queue Processor                            │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Content Processors                         │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Post Processor  │  │ Comment         │  │ Content Chunker │  │
│  │                 │  │ Processor       │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Embedding Service                         │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ OpenAI API      │  │ Rate Limiter    │  │ Retry Handling  │  │
│  │ Integration     │  │                 │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Database Service                          │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Content Update  │  │ Vector Storage  │  │ Metrics Logging │  │
│  │                 │  │                 │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Concurrency Model

The Embedding Processor uses a worker pool pattern:

1. Configurable number of concurrent workers
2. Worker process isolation for resilience
3. Job distribution across workers
4. Graceful handling of worker failures

## Error Handling and Resilience

1. **Retry Mechanism**
   - Exponential backoff for failed requests
   - Maximum retry limits per item
   - Dead-letter handling for consistently failing items

2. **Service Health Checks**
   - Monitoring of external API availability
   - Circuit breaker patterns to avoid overwhelming failing services

3. **Logging and Metrics**
   - Detailed logging of processing steps
   - Performance metrics collection
   - Error tracking and aggregation

## Configuration

The processor supports various configuration options:

1. **Processing Parameters**
   - Batch size
   - Concurrency level
   - Timeout values

2. **Embedding Models**
   - Model selection (text-embedding-3-small by default)
   - Dimension configuration
   - Context settings

3. **Queue Settings**
   - Queue polling interval
   - Prioritization rules
   - Batch processing settings

## Integration Points

1. **Database Integration**
   - PostgreSQL/Supabase for content storage and retrieval
   - Vector operations using pgvector extension

2. **AI Service Integration**
   - OpenAI API for embedding generation
   - Authentication and API key management

3. **Monitoring Integration**
   - Performance logging
   - Error reporting
   - Health check endpoints

## Deployment

The Embedding Processor can be deployed in several ways:

1. Standalone service on a dedicated server
2. Containerized deployment using Docker
3. Scheduled processing jobs
4. Event-driven processing based on database triggers 