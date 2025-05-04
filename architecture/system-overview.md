# LocalGuru System Architecture

## Overview

LocalGuru is a travel recommendation application that utilizes advanced search techniques to provide relevant local information to users. The system consists of several interconnected components that work together to ingest, process, and serve content to users.

## System Components

### 1. Next.js Web Application
The front-end and back-end of the user-facing application, built using Next.js 14 with React and TypeScript.

### 2. Data Ingestion System
A separate service that crawls and processes Reddit and other data sources to extract travel-related content.

### 3. Embedding Processor
A service that generates vector embeddings for content, enabling semantic search capabilities.

### 4. Queue Processor
Manages asynchronous processing tasks, particularly for generating embeddings.

### 5. Supabase Database
PostgreSQL database with vector search capabilities that stores all content and metadata.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    Next.js Web Application                      │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                     Supabase Database                           │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Content Data   │  │  Vector Indexes │  │  User Data      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└────────┬──────────────────────┬───────────────────────┬─────────┘
         │                      │                       │
         ▼                      ▼                       ▼
┌─────────────────┐  ┌─────────────────────┐  ┌─────────────────┐
│                 │  │                     │  │                 │
│ Data Ingestion  │  │ Embedding Processor │  │ Queue Processor │
│                 │  │                     │  │                 │
└─────────────────┘  └─────────────────────┘  └─────────────────┘
```

## Data Flow

1. **Content Ingestion**:
   - Reddit content is crawled and stored in the database
   - Content is preprocessed for search optimization

2. **Embedding Generation**:
   - Text content is processed to generate vector embeddings
   - Embeddings are stored in the database for semantic search

3. **User Queries**:
   - Users enter search queries in the web application
   - Queries are processed using hybrid search (vector + text)
   - Results are ranked and returned to users

4. **Feedback Loop**:
   - User interactions and feedback are captured
   - Search quality is monitored and improved

## Key Technologies

- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS
- **Backend**: Next.js API routes, Supabase Functions
- **Database**: PostgreSQL with pgvector extension
- **Search**: HNSW vector indexes, hybrid search with two-phase retrieval
- **Processing**: Node.js services for data processing

## Component Documentation

For detailed information about each component, refer to the following documents:

- [Web Application Architecture](webapp-architecture.md)
- [Database Schema](database-schema.md)
- [Embedding Processor](embedding-processor-architecture.md)
- [Data Ingestion System](data-ingestion-architecture.md)
- [Search System Architecture](search-architecture.md) 