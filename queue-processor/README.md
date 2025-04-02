# Embedding Queue Processor

A utility to process the LocalGuru embedding queue by making repeated calls to the `process-queue` Supabase Edge Function.

## Features

- Processes records in the embedding queue in batches
- Supports parallel processing with dynamic concurrency
- **Adaptive optimization** to automatically find optimal settings
- Smart error handling with exponential backoff
- Detailed performance tracking and analysis
- Tracks queue statistics (pending, processing, completed, failed)
- Visual progress bar and enhanced logging
- Handles retries for failed batches
- Resets orphaned jobs that have been stuck in processing state
- Supports direct database access for better cross-schema operations

## Requirements

- Node.js 18+
- TypeScript
- Supabase project with the `process-queue` edge function deployed
- Access to the `util.embedding_queue` table

## Setup

1. Create a `.env` file with the following variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional but recommended: Direct database access for cross-schema operations
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:6543/postgres
```

2. Install dependencies:

```
npm install
```

## Usage

Run the script:

```
npm start
```

The script will:

1. Connect to your Supabase project (via REST API or direct database connection if configured)
2. Check for and reset any orphaned jobs
3. Process pending embedding jobs with adaptive batch processing
4. Provide visual progress bar and detailed statistics
5. Analyze performance and optimize processing settings automatically
6. Generate a performance summary with optimal configuration recommendations

## Performance Optimization

The script uses intelligent optimization to maximize throughput:

- **Adaptive Batch Sizing**: Automatically adjusts batch size based on success rate and processing time
- **Dynamic Concurrency**: Changes the number of parallel batches based on performance
- **Performance Tracking**: Monitors and analyzes detailed metrics for each batch
- **Intelligent Scaling**: Gradually increases capacity when successful, quickly reduces when errors occur
- **Rate Limit Protection**: Automatically adjusts to respect API and server limits

## Performance Analysis

The script provides detailed performance metrics during processing:

- Success rate for recent batches
- Average processing time per batch
- Records processed per minute
- Token processing rate
- Estimated OpenAI tier requirements
- Optimal batch size and concurrency recommendations

## Error Handling and Rate Limiting

The script includes robust error handling to deal with common issues:

- **Exponential Backoff**: Automatically increases retry delay for failed batches
- **Adaptive Concurrency**: Reduces parallel processing when errors occur
- **Timeout Protection**: Adds request timeouts to prevent hanging connections
- **Rate Limit Protection**: Automatically pauses processing after multiple failures
- **Error Recovery**: Implements circuit breaker pattern to recover from sustained errors

## Configuration

You can modify the following constants in the script:

- `BATCH_SIZE`: Initial number of records to process per batch (default: 20)
- `PARALLEL_BATCHES`: Initial number of batches to process in parallel (default: 2)
- `ADAPTIVE_SIZING`: Enable/disable automatic optimization (default: true)
- `MAX_BATCH_SIZE`: Maximum batch size the system will scale up to (default: 50)
- `MAX_PARALLEL`: Maximum parallel batches the system will scale up to (default: 5)
- `DELAY_BETWEEN_BATCHES`: Milliseconds to wait between batches (default: 3000)
- `MAX_RETRIES`: Maximum number of retries for failed batches (default: 5)
- `RETRY_DELAY_BASE`: Base delay for retry backoff in milliseconds (default: 5000)
- `PERFORMANCE_WINDOW`: Number of batch results to keep for analysis (default: 20)

## Cross-Schema Access

This utility uses multiple strategies to access the `util.embedding_queue` table:

1. **Direct Database Connection** (preferred): If `DATABASE_URL` is provided, it will connect directly to the Postgres database for reliable cross-schema access.
2. **Fallback to Estimates**: If direct database access isn't available, it will use reasonable estimates based on known values.

## License

MIT 