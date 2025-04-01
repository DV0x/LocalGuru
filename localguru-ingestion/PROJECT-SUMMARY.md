# LocalGuru Reddit Ingestion System - Project Summary

This document provides a comprehensive overview of the LocalGuru Reddit Ingestion System, describing the architecture, components, and functionality implemented across all phases of development.

## Project Overview

The LocalGuru Reddit Ingestion System is designed to fetch Reddit data from specified subreddits, process and detect changes, store the data in a Supabase database, and queue items for embedding. The system supports both standard and historical ingestion and provides comprehensive error handling and logging.

## System Architecture

The system is built on a modular architecture with the following key components:

1. **Reddit Data Fetching**: API client and fetcher for interacting with the Reddit API
2. **Change Detection**: Logic for detecting new and updated content
3. **Database Management**: Handlers for storing and retrieving data
4. **Queue Management**: System for managing embedding requests
5. **Main Orchestrator**: Central component that coordinates all the operations

## Phase 1: Project Setup and Configuration

- Established the project structure and basic configuration
- Set up TypeScript configuration and dependency management
- Created a configuration system for application-wide settings

## Phase 2: Database Schema and Migrations

- Designed and implemented the database schema for Reddit posts and comments
- Created migration files for schema changes
- Added support for embedding queue table

## Phase 3: Core Utilities and API Client

- Implemented logging system with configurable levels and formats
- Created helper functions for retries, delays, and argument processing
- Developed Reddit API client for fetching data from Reddit
- Built RedditFetcher with support for historical data

## Phase 4: Data Processors and Database Interaction

- Implemented ChangeDetector for detecting new and updated content
- Created DBHandler for database operations
- Developed QueueManager for managing embedding requests
- Added comprehensive testing for processors

## Phase 5: Main Orchestrator and Integration

- Implemented the main orchestration logic
- Integrated all components into a cohesive workflow
- Added support for different operation modes
- Created comprehensive error handling and logging
- Developed test scripts for system verification

## Features

### Data Fetching

- Support for fetching posts and comments from specific subreddits
- Historical data fetching with configurable time ranges
- Rate limiting to comply with Reddit API guidelines

### Change Detection

- MD5 checksum-based change detection
- Support for forced updates after configurable time periods
- Separate detection for posts and comments

### Database Management

- Batch processing for efficient database operations
- Support for disabling triggers during bulk operations
- Comprehensive error handling with retries

### Queue Management

- Priority-based queuing system
- Duplicate detection to prevent redundant processing
- Queue cleanup for removing stale items

### Orchestration

- Command-line interface for different operation modes
- Support for standard and historical ingestion
- Integration with Supabase Edge Functions

## Usage

The system can be used in the following modes:

```
# Standard ingestion
npm run ingest -- --subreddit=programming

# Historical ingestion
npm run historical -- --subreddit=programming --months=6

# Queue cleanup
npm run cleanup

# Trigger process-queue
npm run trigger
```

## Testing

The system includes test scripts for verifying functionality:

```
# Test change detector
npm run test:change-detector

# Test main orchestrator
npm run test:orchestrator
```

## Configuration

The system is highly configurable through:

1. Environment variables (`.env` file)
2. Configuration file (`src/config.ts`)
3. Command-line arguments

## Future Enhancements

Potential enhancements for future phases:

1. Web interface for monitoring and control
2. Support for additional data sources
3. Enhanced analytics and reporting
4. Scheduled ingestion with configurable intervals
5. Advanced filtering for specific content types 