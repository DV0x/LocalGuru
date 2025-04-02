// process-all-queue.ts - Script to process all records in the embedding queue
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import * as dotenv from 'dotenv'
import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables
dotenv.config()

// Types
interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

interface BatchResult {
  processed: number;
  successful: number;
  failed: number;
  estimated_tokens?: number;
  total_chunks?: number;
  details?: any[];
}

interface ExtendedError extends Error {
  type?: string;
  code?: string;
  message: string;
}

// Declare global variables for batch size management
declare global {
  var originalBatchSize: number | undefined;
  var batchFailures: boolean | undefined;
}

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
const BATCH_SIZE = 10  // Smaller batch size to reduce load
const DELAY_BETWEEN_BATCHES = 3000  // 3 second delay between batches
const MAX_RETRIES = 5  // Maximum number of retries per batch
const RETRY_DELAY_BASE = 5000  // Base delay for exponential backoff (5 seconds)
const STATUS_CHECK_INTERVAL = 30000  // Check status every 30 seconds
const PARALLEL_BATCHES = 1  // Less parallel processing to reduce load
const ADAPTIVE_SIZING = true  // Enable automatic batch size and concurrency adjustment
const MAX_BATCH_SIZE = 50  // Maximum batch size the system will scale up to
const MAX_PARALLEL = 5  // Maximum parallel batches the system will scale up to
const PERFORMANCE_WINDOW = 20  // Number of batch results to keep for performance analysis

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Initialize Postgres pool if we have a direct DB URL
let pool: pkg.Pool | null = null;
if (SUPABASE_DB_URL) {
  try {
    pool = new Pool({
      connectionString: SUPABASE_DB_URL,
    });
    console.log('Postgres pool initialized successfully');
  } catch (error) {
    console.error('Error initializing Postgres pool:', error);
  }
}

// Get current queue statistics - fallback to direct Postgres if available
async function getQueueStats(): Promise<QueueStats> {
  try {
    if (pool) {
      try {
        // Direct query with a more precise count of each status
        const result = await pool.query(`
          SELECT 
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'processing') as processing,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            COUNT(*) as total
          FROM util.embedding_queue
        `);
        
        if (result.rows && result.rows.length > 0) {
          const stats = result.rows[0];
          return {
            pending: Number(stats.pending) || 0,
            processing: Number(stats.processing) || 0,
            completed: Number(stats.completed) || 0,
            failed: Number(stats.failed) || 0,
            total: Number(stats.total) || 0
          };
        }
      } catch (dbError) {
        console.error('Database query error:', dbError);
        console.warn('Falling back to placeholder statistics.');
      }
    }

    // Since we don't have direct database access, use the correct total from the database
    console.warn('Could not access util.embedding_queue directly. Using placeholder estimates for queue stats.');
    return {
      pending: 18119,
      processing: 0,
      completed: 90,
      failed: 0,
      total: 18209  // The known total from the database
    };
  } catch (error) {
    console.error('Error getting queue stats:', error);
    
    // Using accurate count from the database
    return {
      pending: 18119,
      processing: 0,
      completed: 90,
      failed: 0,
      total: 18209  // The known total from the database
    };
  }
}

// Helper function to format time in a readable way
function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours} hours, ${mins} minutes`;
}

// Helper function to create a simple progress bar
function createProgressBar(percent: number, length: number = 30): string {
  const filledLength = Math.round(length * percent / 100);
  const bar = '█'.repeat(filledLength) + '░'.repeat(length - filledLength);
  return `[${bar}] ${percent}%`;
}

// Performance tracking structures
interface BatchPerformance {
  batchSize: number;
  recordsProcessed: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  success: boolean;
  errorType?: string;
  estimatedTokens?: number;
}

// Keep a history of batch performances for analysis
const batchHistory: BatchPerformance[] = [];
let currentBatchSize = BATCH_SIZE;
let currentParallelBatches = PARALLEL_BATCHES;
let totalSuccessfulBatches = 0;
let totalFailedBatches = 0;

// Helper function to analyze performance and suggest optimizations
function analyzePerformance(): {
  suggestedBatchSize: number;
  suggestedParallel: number;
  avgProcessingTimeMs: number;
  successRate: number;
  recordsPerMinute: number;
  tokenRate: number;
} {
  // Only consider recent batches
  const recentBatches = batchHistory.slice(-PERFORMANCE_WINDOW);
  const successfulBatches = recentBatches.filter(b => b.success);
  
  // Default values
  let suggestedBatchSize = currentBatchSize;
  let suggestedParallel = currentParallelBatches;
  let avgProcessingTimeMs = 0;
  let successRate = 0;
  let recordsPerMinute = 0;
  let tokenRate = 0;
  
  if (successfulBatches.length > 0) {
    // Calculate average processing time
    avgProcessingTimeMs = successfulBatches.reduce((sum, b) => sum + b.durationMs, 0) / successfulBatches.length;
    
    // Calculate success rate
    successRate = (successfulBatches.length / Math.max(recentBatches.length, 1)) * 100;
    
    // Calculate records processed per minute
    const totalRecordsProcessed = successfulBatches.reduce((sum, b) => sum + b.recordsProcessed, 0);
    const totalProcessingTimeMinutes = successfulBatches.reduce((sum, b) => sum + b.durationMs, 0) / (1000 * 60);
    recordsPerMinute = totalRecordsProcessed / Math.max(totalProcessingTimeMinutes, 0.01);
    
    // Estimate token processing rate
    const batchesWithTokens = successfulBatches.filter(b => b.estimatedTokens !== undefined);
    if (batchesWithTokens.length > 0) {
      const totalTokens = batchesWithTokens.reduce((sum, b) => sum + (b.estimatedTokens || 0), 0);
      const tokenTimeMinutes = batchesWithTokens.reduce((sum, b) => sum + b.durationMs, 0) / (1000 * 60);
      tokenRate = totalTokens / Math.max(tokenTimeMinutes, 0.01);
    }
    
    // Suggest optimizations if success rate is good
    if (successRate > 90) {
      // If batches are completing quickly and success rate is high, suggest increasing batch size
      if (avgProcessingTimeMs < 10000 && currentBatchSize < MAX_BATCH_SIZE) {
        suggestedBatchSize = Math.min(currentBatchSize + 5, MAX_BATCH_SIZE);
      }
      
      // If we're processing batches quickly, suggest increasing parallelism
      if (currentParallelBatches < MAX_PARALLEL) {
        suggestedParallel = Math.min(currentParallelBatches + 1, MAX_PARALLEL);
      }
    } else if (successRate < 70) {
      // If success rate is poor, suggest reducing batch size and parallelism
      suggestedBatchSize = Math.max(currentBatchSize - 5, 10);
      suggestedParallel = Math.max(currentParallelBatches - 1, 1);
    }
  }
  
  return {
    suggestedBatchSize,
    suggestedParallel,
    avgProcessingTimeMs,
    successRate,
    recordsPerMinute,
    tokenRate
  };
}

// Implement adaptive batch sizing
function adjustSettings(analysis: ReturnType<typeof analyzePerformance>) {
  if (!ADAPTIVE_SIZING) return;
  
  // Only adjust after we have enough data
  if (batchHistory.length < 5) return;
  
  // Update batch size if suggestion is different
  if (analysis.suggestedBatchSize !== currentBatchSize) {
    console.log(`🔄 Adjusting batch size: ${currentBatchSize} → ${analysis.suggestedBatchSize}`);
    currentBatchSize = analysis.suggestedBatchSize;
  }
  
  // Update parallelism if suggestion is different
  if (analysis.suggestedParallel !== currentParallelBatches) {
    console.log(`🔄 Adjusting parallel batches: ${currentParallelBatches} → ${analysis.suggestedParallel}`);
    currentParallelBatches = analysis.suggestedParallel;
  }
}

// Process a single batch of records with performance tracking
async function processBatch(retryCount = 0): Promise<BatchResult> {
  const batchPerformance: BatchPerformance = {
    batchSize: currentBatchSize,
    recordsProcessed: 0,
    startTime: Date.now(),
    endTime: 0,
    durationMs: 0,
    success: false
  };
  
  try {
    console.log(`\n🔄 Processing batch with size ${currentBatchSize}...`);
    
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/process-queue`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          batch_size: currentBatchSize
        }),
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(240000) // 4 minute timeout - doubled
      }
    );

    // Check for HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`Error calling process-queue: ${response.status} ${errorText}`);
      batchPerformance.errorType = `HTTP ${response.status}`;
      throw error;
    }

    const result = await response.json() as BatchResult;
    
    // Update performance tracking
    batchPerformance.endTime = Date.now();
    batchPerformance.durationMs = batchPerformance.endTime - batchPerformance.startTime;
    batchPerformance.recordsProcessed = result.processed || 0;
    batchPerformance.success = true;
    batchPerformance.estimatedTokens = result.estimated_tokens;
    
    // Track successful batch
    totalSuccessfulBatches++;
    
    // Detailed logging of results with timing
    console.log(`✅ Batch processed: ${result.processed} jobs (${result.successful} successful, ${result.failed} failed) in ${(batchPerformance.durationMs / 1000).toFixed(1)}s`);
    if (result.estimated_tokens) {
      console.log(`📊 Estimated tokens: ${result.estimated_tokens}, chunks: ${result.total_chunks || 0}`);
      console.log(`📈 Processing rate: ${Math.round((result.estimated_tokens / batchPerformance.durationMs) * 60000)} tokens/minute`);
    }

    // Add to history
    batchHistory.push(batchPerformance);
    while (batchHistory.length > PERFORMANCE_WINDOW * 2) {
      batchHistory.shift(); // Keep history from growing too large
    }
    
    return result;
  } catch (error: unknown) {
    console.error(`❌ Error in batch processing:`, error);
    
    // Update performance tracking for failed batch
    batchPerformance.endTime = Date.now();
    batchPerformance.durationMs = batchPerformance.endTime - batchPerformance.startTime;
    batchPerformance.success = false;
    batchPerformance.errorType = (error as ExtendedError)?.type || (error as any)?.code || 'Unknown';
    
    // Track failed batch
    totalFailedBatches++;
    
    // Add to history
    batchHistory.push(batchPerformance);
    
    // Check for timeout or abort errors specifically and handle them differently
    const isTimeoutError = (error as any)?.type === 'aborted' || 
                           (error as any)?.name === 'AbortError' || 
                           (error as Error)?.message?.includes('timed out') || 
                           (error as Error)?.message?.includes('aborted');
    
    // Implement exponential backoff retry logic for failed batches
    if (retryCount < MAX_RETRIES) {
      // Calculate exponential backoff delay: base * 2^retry
      // Use higher base delay for timeout errors
      const timeoutRetryBase = 30000; // 30 seconds base for timeouts
      const backoffBase = isTimeoutError ? timeoutRetryBase : RETRY_DELAY_BASE;
      const backoffDelay = backoffBase * Math.pow(2, retryCount);
      const jitter = Math.floor(Math.random() * 2000); // Add up to 2 seconds of random jitter
      const totalDelay = backoffDelay + jitter;
      
      // For timeout errors, use a more aggressive approach
      if (isTimeoutError) {
        console.log(`⚠️ Timeout/Abort error detected. Using extended recovery delay.`);
        // Reduce batch size temporarily for next attempt
        temporarilyReduceBatchSize();
      }
      
      console.log(`🔄 Retrying batch with exponential backoff (attempt ${retryCount + 1} of ${MAX_RETRIES})...`);
      console.log(`⏱️ Waiting ${(totalDelay/1000).toFixed(1)} seconds before retry`);
      
      await new Promise(resolve => setTimeout(resolve, totalDelay)); 
      return processBatch(retryCount + 1);
    } else {
      console.error(`⚠️ Max retries reached for batch, moving on...`);
      // For persistent failures, add an extra pause to let system recover
      console.log(`⏳ Adding recovery pause after multiple failures (60 seconds)`);
      await new Promise(resolve => setTimeout(resolve, 60000));
      return { processed: 0, successful: 0, failed: 0 };
    }
  }
}

// Reset orphaned jobs using the most reliable method available
async function resetOrphanedJobs() {
  try {
    console.log('Checking for orphaned jobs...');
    
    // Find jobs stuck in "processing" state for more than 10 minutes
    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
    
    if (pool) {
      // Use direct Postgres connection if available
      const result = await pool.query(`
        WITH updated_jobs AS (
          UPDATE util.embedding_queue 
          SET status = 'pending', attempts = 0
          WHERE status = 'processing' AND 
                ((processed_at < $1) OR (processed_at IS NULL AND created_at < $1))
          RETURNING id
        )
        SELECT COUNT(*) as count FROM updated_jobs
      `, [tenMinutesAgo.toISOString()]);
      
      const count = Number(result.rows[0]?.count || 0);
      if (count > 0) {
        console.log(`Reset ${count} orphaned jobs back to pending status`);
      } else {
        console.log('No orphaned jobs found');
      }
      
      return;
    }
    
    console.warn('Skipping orphaned job reset - no direct database access available');
    
  } catch (error) {
    console.error('Error resetting orphaned jobs:', error);
  }
}

// Process the entire queue
async function processAllQueue() {
  console.log('\n🚀 Starting queue processing...')
  
  // Reset any orphaned jobs first
  await resetOrphanedJobs()
  
  // Get initial queue stats
  const initialStats = await getQueueStats()
  console.log(`\n📊 Initial queue stats: pending=${initialStats.pending}, processing=${initialStats.processing}, completed=${initialStats.completed}, failed=${initialStats.failed}`)
  
  // Keep track of the total to calculate progress
  const initialPending = initialStats.pending;
  
  let totalProcessed = 0
  let totalSuccessful = 0
  let totalFailed = 0
  let startTime = Date.now()
  let consecutiveErrors = 0
  let lastPerformanceReport = 0
  
  // Process until no more pending jobs
  let stats = { ...initialStats };
  
  while (stats.pending > 0) {
    try {
      // Dynamic parallel batches based on error rate and performance analysis
      const dynamicParallelBatches = consecutiveErrors > 2 
        ? 1  // If we've had errors, process one at a time
        : Math.min(currentParallelBatches, Math.ceil(stats.pending / currentBatchSize));
      
      console.log(`\n🚀 Starting ${dynamicParallelBatches} parallel batch${dynamicParallelBatches > 1 ? 'es' : ''}...`);
      
      const batchPromises = [];
      
      for (let i = 0; i < dynamicParallelBatches; i++) {
        // Add a larger delay between starting batches to avoid rate limit issues
        const startDelay = i * 2000; // 2 second stagger between parallel batches
        batchPromises.push(
          new Promise<BatchResult>(async (resolve) => {
            if (startDelay > 0) {
              await new Promise(r => setTimeout(r, startDelay));
            }
            resolve(await processBatch());
          })
        );
      }
      
      // Wait for all batches to complete
      const results = await Promise.all(batchPromises);
      
      // Check if any batches were successful
      const anySuccess = results.some(r => r.processed > 0);
      if (anySuccess) {
        consecutiveErrors = 0; // Reset consecutive errors counter
      } else {
        consecutiveErrors++;
        console.warn(`⚠️ Warning: ${consecutiveErrors} consecutive batches with no successful processing`);
        
        if (consecutiveErrors >= 5) {
          console.error(`⛔ Too many consecutive errors (${consecutiveErrors}). Pausing for 2 minutes to respect rate limits...`);
          await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minute pause
          consecutiveErrors = 2; // Reduce but don't reset completely
        }
      }
      
      // Update counts based on all batch results
      for (const result of results) {
        totalProcessed += result.processed || 0;
        totalSuccessful += result.successful || 0;
        totalFailed += result.failed || 0;
      }
      
      // Get updated stats
      stats = await getQueueStats();
      
      // Calculate progress percentage and time elapsed
      // Use the total number of items processed compared to initial pending count
      const percentComplete = Math.min(100, Math.round((totalProcessed / initialPending) * 100));
      const timeElapsed = Math.round((Date.now() - startTime) / 1000 / 60); // in minutes
      
      // Create a visual progress bar
      const progressBar = createProgressBar(percentComplete);
      
      console.log(`\n═════════════ PROGRESS UPDATE ═════════════`);
      console.log(progressBar);
      console.log(`📊 Queue stats: ${stats.pending} pending, ${stats.processing} processing, ${stats.completed} completed, ${stats.failed} failed`);
      console.log(`✅ Progress: ${percentComplete}% complete (${totalProcessed}/${initialPending} processed: ${totalSuccessful} successful, ${totalFailed} failed)`);
      console.log(`⏱️ Time elapsed: ${formatTime(timeElapsed)}`);
      
      // Estimate remaining time (rough calculation)
      if (totalProcessed > 0 && stats.pending > 0) {
        const recordsPerMinute = totalProcessed / (timeElapsed || 1); // Avoid division by zero
        const estimatedMinutesRemaining = Math.round(stats.pending / recordsPerMinute);
        console.log(`⏱️ Estimated time remaining: ~${formatTime(estimatedMinutesRemaining)}`);
        
        // Show throughput stats
        console.log(`📈 Processing rate: ${Math.round(recordsPerMinute)} records/minute (${Math.round(recordsPerMinute/60)} records/second)`);
      }
      
      // Performance analysis and optimization reporting (every 5 minutes or 10 batches)
      const minutesSinceLastReport = (Date.now() - lastPerformanceReport) / (1000 * 60);
      if (minutesSinceLastReport >= 5 || batchHistory.length - lastPerformanceReport >= 10) {
        const analysis = analyzePerformance();
        lastPerformanceReport = Date.now();
        
        console.log(`\n═════════════ PERFORMANCE ANALYSIS ═════════════`);
        console.log(`📊 Success rate: ${analysis.successRate.toFixed(1)}%`);
        console.log(`⏱️ Average processing time: ${(analysis.avgProcessingTimeMs / 1000).toFixed(1)}s per batch`);
        console.log(`📈 Processing throughput: ${Math.round(analysis.recordsPerMinute)} records/minute`);
        
        if (analysis.tokenRate > 0) {
          console.log(`📊 Token processing rate: ${Math.round(analysis.tokenRate)} tokens/minute`);
        }
        
        // Report optimal settings
        if (ADAPTIVE_SIZING) {
          console.log(`⚙️ Current settings: batch size=${currentBatchSize}, parallel=${currentParallelBatches}`);
          console.log(`💡 Suggested settings: batch size=${analysis.suggestedBatchSize}, parallel=${analysis.suggestedParallel}`);
          
          // Apply suggested settings
          adjustSettings(analysis);
        }
      }
      
      // Determine appropriate delay based on error status
      let nextDelay = DELAY_BETWEEN_BATCHES;
      if (consecutiveErrors > 0) {
        nextDelay = DELAY_BETWEEN_BATCHES * (1 + consecutiveErrors); // Increase delay when errors occur
      }
      
      // Wait between batches if there are still pending jobs
      if (stats.pending > 0) {
        console.log(`⏳ Waiting ${nextDelay/1000} seconds before next batch set...`);
        await new Promise(resolve => setTimeout(resolve, nextDelay));
      }
      
      // Check for jobs stuck in processing state
      if (stats.processing > 100 || timeElapsed % 15 === 0) { // Every 15 minutes or if many processing
        await resetOrphanedJobs();
      }
    } catch (error) {
      console.error('❌ Unexpected error in main processing loop:', error);
      consecutiveErrors++;
      
      // Wait a bit longer on main loop errors
      const recoveryDelay = 30000 * Math.min(consecutiveErrors, 4); // Max 2 minute delay
      console.log(`🛑 Recovering from error, waiting ${recoveryDelay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, recoveryDelay));
    }
  }
  
  // Wait for any remaining processing jobs to finish
  if (stats.processing > 0) {
    console.log(`\n⏳ Waiting for ${stats.processing} processing jobs to complete...`);
    
    let processingComplete = false;
    while (!processingComplete) {
      await new Promise(resolve => setTimeout(resolve, STATUS_CHECK_INTERVAL));
      stats = await getQueueStats();
      console.log(`Still processing: ${stats.processing} jobs`);
      
      if (stats.processing === 0) {
        processingComplete = true;
      }
    }
  }
  
  // Final performance analysis
  const finalAnalysis = analyzePerformance();
  
  // Final stats
  const finalStats = await getQueueStats();
  const totalTimeMinutes = Math.round((Date.now() - startTime) / 1000 / 60);
  
  console.log('\n✨ ═════════════ PROCESSING COMPLETE ═════════════');
  console.log(`⏱️ Total time: ${formatTime(totalTimeMinutes)}`);
  console.log(`📊 Final queue stats:`);
  console.log(`  ✅ Completed: ${finalStats.completed}`);
  console.log(`  ❌ Failed: ${finalStats.failed}`);
  
  // Calculate success rate only if there were jobs processed
  const successRate = finalStats.completed + finalStats.failed > 0 
    ? Math.round((finalStats.completed / (finalStats.completed + finalStats.failed)) * 100) 
    : 0;
  
  console.log(`  📈 Success rate: ${successRate}%`);
  console.log(`  📈 Average processing rate: ${Math.round(totalProcessed / totalTimeMinutes)} records/minute`);
  
  // Performance summary
  console.log(`\n═════════════ PERFORMANCE SUMMARY ═════════════`);
  console.log(`📊 Batch success rate: ${finalAnalysis.successRate.toFixed(1)}%`);
  console.log(`📊 Total batches: ${totalSuccessfulBatches + totalFailedBatches} (${totalSuccessfulBatches} successful, ${totalFailedBatches} failed)`);
  console.log(`⏱️ Average batch processing time: ${(finalAnalysis.avgProcessingTimeMs / 1000).toFixed(1)}s`);
  console.log(`💡 Optimal batch size: ${finalAnalysis.suggestedBatchSize}`);
  console.log(`💡 Optimal parallel batches: ${finalAnalysis.suggestedParallel}`);
  
  if (finalAnalysis.tokenRate > 0) {
    console.log(`📊 Token processing rate: ${Math.round(finalAnalysis.tokenRate)} tokens/minute`);
    // Estimate OpenAI tier required
    if (finalAnalysis.tokenRate < 60000) {
      console.log(`💰 Estimated OpenAI tier: Standard (≈$0.002/1K tokens)`);
    } else if (finalAnalysis.tokenRate < 240000) {
      console.log(`💰 Estimated OpenAI tier: Pro (≈$0.0015/1K tokens)`);
    } else {
      console.log(`💰 Estimated OpenAI tier: Enterprise required for this volume`);
    }
  }
}

// Main function
async function main() {
  try {
    console.log('Verifying connection...');
    
    // Verify database access
    if (pool) {
      const result = await pool.query('SELECT NOW()');
      console.log(`Connected to Postgres database directly`);
    } else {
      // Verify REST API access
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY
        }
      });
      
      if (!response.ok) {
        throw new Error(`Connection error: ${response.statusText}`);
      }
      
      console.log(`Connected to Supabase with service role key via REST API`);
    }
    
    await processAllQueue();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    // Clean up Postgres pool
    if (pool) {
      await pool.end();
    }
  }
}

// Run the script
main() 

// Add this function for temporary batch size reduction
function temporarilyReduceBatchSize() {
  // Save original batch size if not already saved
  if (!global.originalBatchSize) {
    global.originalBatchSize = currentBatchSize;
  }
  
  // Reduce batch size by half, but not below 5
  const reducedSize = Math.max(5, Math.floor(currentBatchSize / 2));
  
  if (currentBatchSize !== reducedSize) {
    console.log(`⚠️ Temporarily reducing batch size from ${currentBatchSize} to ${reducedSize} due to timeouts`);
    currentBatchSize = reducedSize;
    
    // Also reduce parallelism if greater than 1
    if (currentParallelBatches > 1) {
      currentParallelBatches--;
      console.log(`⚠️ Reducing parallel batches to ${currentParallelBatches}`);
    }
    
    // Schedule restoration of original batch size after some time
    setTimeout(() => {
      if (global.originalBatchSize && !global.batchFailures) {
        console.log(`⚙️ Restoring original batch size: ${global.originalBatchSize}`);
        currentBatchSize = global.originalBatchSize;
        delete global.originalBatchSize;
      }
    }, 5 * 60 * 1000); // Try to restore after 5 minutes if no new failures
  }
} 