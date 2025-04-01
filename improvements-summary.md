# Resilience Improvements for Reddit Ingestion System

## Problem Statement
The system needs to handle network errors, timeouts, and failures when fetching large amounts of data from Reddit API without requiring a complete restart of the process.

## Solutions Implemented

### 1. Retry Logic with Exponential Backoff
- Added retry mechanism to Reddit API requests with exponential backoff
- Defined different handling for various error types:
  - Network errors (ETIMEDOUT, ECONNRESET, etc.)
  - Server errors (5xx)
  - Rate limiting (429)
- Configured parameters:
  - Maximum retry attempts
  - Initial and maximum delay times
  - Added jitter to prevent thundering herd problem

### 2. Checkpointing Mechanism
- Implemented checkpoint storage for reddit fetching
- Checkpoints store:
  - Current position in the fetch process
  - IDs of already processed items
  - Last pagination token ("after" parameter)
  - Progress stats
- Saves checkpoints at regular intervals:
  - After every N posts processed
  - At the end of each pagination page
  - When errors occur
- Automatically resumes from latest checkpoint

### 3. Transaction Support
- Added database transaction support:
  - Begin transaction before batch operations
  - Commit on success, rollback on error
- Ensures data consistency even with partial failures

### 4. Error Handling Improvements
- Enhanced error logging with detailed information
- Different handling strategies based on error type
- Returns partial results when possible rather than failing entirely

### 5. Foreign Key Constraint Handling
- Added user insertion before post/comment insertion
- Ensures referential integrity is maintained

## Benefits
- More robust ingestion process that can withstand intermittent failures
- Efficient use of resources by avoiding redundant work
- Better operational visibility with improved logging
- Consistent database state even with failures

## Usage
To use these resilient features:
- Set `useCheckpoints: true` when calling `fetchSubreddit`
- Configure retry parameters as needed
- Monitor checkpoint files to track progress
