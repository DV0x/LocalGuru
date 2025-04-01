# Localguru Reddit Data Ingestion

A system for ingesting, processing, and embedding Reddit data for the Localguru smart travel recommendation engine.

## Overview

This system fetches data from Reddit, processes it for changes, and prepares it for vector embeddings to power Localguru's semantic search capabilities.

## Features

- Reddit API integration with rate limiting and error handling
- Change detection system to identify new and updated content
- Queue management for embedding generation
- Integration with Supabase for storage and vector operations
- Detailed logging system
- Automation scripts for daily ingestion and historical data fetching

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure environment variables by copying `.env.example` to `.env` and setting appropriate values
4. Build the project:
   ```
   npm run build
   ```

## Usage

### Daily Ingestion

To run the daily ingestion process:

```
npm run ingest
```

### Historical Data Import

To import historical data from a subreddit:

```
npm run historical -- --subreddit=AskSF --months=12
```

### Queue Management

To manually trigger the embedding queue processing:

```
npm run trigger
```

To clean up the embedding queue:

```
npm run cleanup
```

## Project Structure

- `src/fetchers`: Reddit API interaction code
- `src/processors`: Content processing and change detection
- `src/db`: Database interaction code and schema management
- `src/queue`: Queue management for embeddings
- `src/utils`: Utility functions for logging, retries, etc.
- `scripts`: Automation scripts for setup and maintenance

## Database Schema

The system uses the following database tables:

1. `reddit_users`: Stores information about Reddit users
2. `reddit_posts`: Stores Reddit posts with change tracking and embedding support
3. `reddit_comments`: Stores Reddit comments with change tracking and embedding support
4. `embedding_queue`: Manages the queue for generating embeddings

The schema includes support for:

- Content change detection via checksums
- Tracking update history and removal status
- Optimized embedding processing queue with priority handling
- Queue maintenance functions for cleanup and performance

## Database Maintenance

The system provides functions for database queue maintenance:

- `reset_stuck_processing_jobs()`: Resets jobs that are stuck in processing state
- `prune_completed_jobs(keep_count)`: Removes old completed jobs beyond the specified count
- `trim_queue_to_size(max_size)`: Trims the pending queue to maintain performance

## Development

To set up the development environment:

1. Set up environment variables in `.env` (see `.env.example` for reference)
2. Install dependencies: `npm install`
3. Run the application in development mode: `npm run dev` 