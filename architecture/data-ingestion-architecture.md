# Data Ingestion Architecture

## Overview

The Data Ingestion system is responsible for collecting, processing, and storing content from Reddit and other sources for the LocalGuru application. It focuses on travel-related content, particularly discussions about locations, activities, and recommendations.

## Directory Structure

```
localguru-ingestion/
├── src/
│   ├── fetchers/     # Data source connectors
│   ├── processors/   # Content processing logic
│   ├── db/           # Database interactions
│   ├── queue/        # Queue management
│   ├── utils/        # Utility functions
│   ├── sql/          # SQL queries
│   ├── scripts/      # Utility scripts
│   ├── index.ts      # Main entry point
│   └── config.ts     # Configuration
├── checkpoints/      # Ingestion state tracking
└── logs/             # Logging output
```

## Key Components

### 1. Data Fetchers

Components responsible for retrieving data from external sources:

- **RedditFetcher**: Retrieves posts and comments from Reddit using the Reddit API
- **SubredditFetcher**: Handles subreddit-specific fetching logic
- **PostFetcher**: Retrieves detailed post and comment data
- **IncrementalFetcher**: Handles incremental fetching to avoid duplicate content

### 2. Content Processors

Transform raw content into structured data for storage:

- **TextProcessor**: Cleans and normalizes text content
- **EntityExtractor**: Identifies entities like locations and activities
- **TopicClassifier**: Classifies content into relevant topics
- **DuplicateDetector**: Identifies and handles duplicate content
- **ContentFilter**: Filters out irrelevant or low-quality content

### 3. Database Management

Components handling database operations:

- **DatabaseService**: Core service for database interactions
- **ContentRepository**: Manages content storage and retrieval
- **BatchProcessor**: Handles bulk database operations
- **TransactionManager**: Manages database transactions

### 4. Queue System

Manages processing tasks and ensures reliability:

- **QueueManager**: Core queue management
- **TaskScheduler**: Schedules processing tasks
- **RetryHandler**: Manages retry logic for failed operations
- **PriorityQueue**: Prioritizes content based on relevance

## Ingestion Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                       Data Sources                              │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Reddit API     │  │  Subreddit      │  │  Post/Comment   │  │
│  │                 │  │  Discovery      │  │  Threads        │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                       Fetchers                                  │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Reddit Fetcher  │  │ Subreddit       │  │ Post/Comment    │  │
│  │                 │  │ Fetcher         │  │ Fetcher         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                       Processors                                │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Text Processor  │  │ Entity          │  │ Topic           │  │
│  │                 │  │ Extractor       │  │ Classifier      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                       Storage                                   │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Database        │  │ Embedding       │  │ Index           │  │
│  │ Service         │  │ Queue           │  │ Updates         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Processing Pipeline

1. **Source Selection**
   - Identify relevant subreddits and content sources
   - Configure the fetching parameters (timeframe, post types, etc.)

2. **Content Fetching**
   - Retrieve posts and comments from Reddit API
   - Implement rate limiting to respect API constraints
   - Handle pagination and incremental fetching

3. **Content Processing**
   - Clean and normalize text content
   - Extract entities and metadata
   - Classify content by topic and relevance

4. **Filtering & Enrichment**
   - Filter out irrelevant or low-quality content
   - Enrich content with additional metadata
   - Prepare content for storage

5. **Storage**
   - Store processed content in the database
   - Queue content for embedding generation
   - Update search indexes

## Targeted Subreddits

The ingestion system primarily targets travel-related subreddits, including:

- r/travel
- r/AskSF
- r/AskNYC
- r/TravelHacks
- r/solotravel
- r/backpacking
- r/travel_advice
- r/travelhacks
- Location-specific subreddits (r/sanfrancisco, r/nyc, etc.)

## Incremental Update Strategy

The system uses an incremental approach to keep content fresh:

1. **Checkpoint Management**
   - Tracks last processed content by timestamp
   - Maintains state across process restarts

2. **Update Strategy**
   - Regular processing of new content
   - Periodic reprocessing of popular content
   - Update detection based on content checksums

3. **Content Freshness**
   - Prioritizes recent content
   - Updates existing content when changed
   - Handles deleted or removed content

## Error Handling and Resilience

1. **API Outage Handling**
   - Graceful backoff during API limitations
   - Alternate data sources during outages
   - Resume capability from last checkpoint

2. **Data Integrity**
   - Validation before storage
   - Transaction management
   - Duplicate detection and handling

3. **Process Recovery**
   - Checkpoint-based resumption
   - Failed item tracking and retry
   - Monitoring and alerting

## Configuration and Extensibility

1. **Configurable Parameters**
   - Content sources and filters
   - Processing rules and thresholds
   - Storage and queue settings

2. **Pluggable Architecture**
   - Easily add new data sources
   - Customize processing pipeline
   - Integrate additional enrichment services

3. **Monitoring & Metrics**
   - Content processing statistics
   - Error and success rates
   - Queue health and backlog monitoring 