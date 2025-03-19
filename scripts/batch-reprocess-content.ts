import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { setTimeout } from 'timers/promises';
import * as fs from 'fs';
import * as path from 'path';

// Try to load environment variables from different potential locations
dotenv.config();

// If .env didn't have our variables, try .env.local
try {
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const envLocalContent = fs.readFileSync(envLocalPath, 'utf8');
    // Parse the content to get SUPABASE_SERVICE_ROLE_KEY
    const envVars = envLocalContent.split('\n').reduce((acc, line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        acc[match[1]] = match[2].trim();
      }
      return acc;
    }, {} as Record<string, string>);
    
    // Set any missing environment variables
    if (envVars.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
      process.env.SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (envVars.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
    }
  }
} catch (error) {
  console.warn('Error loading .env.local file:', error);
}

// Use the correct credentials
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ghjbtvyalvigvmuodaas.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoamJ0dnlhbHZpZ3ZtdW9kYWFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDc0NDEwNiwiZXhwIjoyMDU2MzIwMTA2fQ.wn5hTplkrRS4YaFNJX2enXcxxlwX_Z52BbcSU1R2W5E';

// Debug output to verify credentials are loaded correctly (redacted for security)
console.log('Using Supabase URL:', supabaseUrl);
console.log('Service Role Key loaded:', supabaseKey ? 'Yes (redacted)' : 'No');

// Initialize Supabase client
const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

// Configuration options for processing
interface BatchProcessingOptions {
  contentType: 'all' | 'posts' | 'comments';
  batchSize: number;
  processDelay: number; // milliseconds between batches
  maxBatches: number; // Maximum number of batches to process in one run
  priority: number;
  subreddit?: string;
  maxAgeHours?: number;
  minAgeHours?: number;
  representationTypes?: string[]; // Representation types to process
}

const defaultOptions: BatchProcessingOptions = {
  contentType: 'all',
  batchSize: 50,
  processDelay: 10000, // 10 seconds
  maxBatches: 20,
  priority: 5,
  representationTypes: ['context_enhanced'],
};

/**
 * Process content in batches and queue for reprocessing
 */
async function batchReprocessContent(options: BatchProcessingOptions = defaultOptions): Promise<void> {
  console.log('Starting batch reprocessing with options:', options);
  
  const {
    contentType,
    batchSize,
    processDelay,
    maxBatches,
    priority,
    subreddit,
    maxAgeHours,
    minAgeHours,
    representationTypes
  } = options;
  
  // Summary stats
  let totalQueued = 0;
  let totalPosts = 0;
  let totalComments = 0;
  let batchesProcessed = 0;
  
  // Get initial status
  console.log('Fetching initial status...');
  
  try {
    // Get representation coverage if available
    const { data: coverageData, error: coverageError } = await supabase
      .rpc('get_representation_coverage');
      
    if (!coverageError && coverageData) {
      console.log('Initial representation coverage:');
      console.log(`- Total posts: ${coverageData.post_stats.total_posts}`);
      console.log(`- Total comments: ${coverageData.comment_stats.total_comments}`);
      console.log(`- Posts missing context_enhanced representations: ${coverageData.post_stats.missing_context_enhanced}`);
      console.log(`- Comments missing context_enhanced representations: ${coverageData.comment_stats.missing_context_enhanced}`);
    }
  } catch (error) {
    // Fallback to older status function
    const { data: initialStatus, error: statusError } = await supabase
      .rpc('get_content_representation_status', {
        filter_subreddit: subreddit
      });
      
    if (statusError) {
      console.error('Error getting initial status:', statusError.message);
    } else if (initialStatus) {
      console.log('Initial status:');
      console.log(`- Posts: ${initialStatus.post_stats.total_posts} total, ${initialStatus.post_stats.posts_with_context_rep} with context enhanced`);
      console.log(`- Comments: ${initialStatus.comment_stats.total_comments} total, ${initialStatus.comment_stats.comments_with_context_rep} with context enhanced`);
      console.log(`- Queue: ${initialStatus.queue_stats.pending_posts + initialStatus.queue_stats.pending_comments} pending, ${initialStatus.queue_stats.processing_posts + initialStatus.queue_stats.processing_comments} processing`);
    }
  }
  
  // Process batches
  let continueProcessing = true;
  
  while (continueProcessing && batchesProcessed < maxBatches) {
    console.log(`Processing batch ${batchesProcessed + 1}/${maxBatches}...`);
    
    const { data: result, error } = await supabase
      .rpc('refresh_content_representations', {
        refresh_type: contentType,
        batch_size: batchSize,
        filter_subreddit: subreddit,
        min_age_hours: minAgeHours,
        max_age_hours: maxAgeHours,
        representation_types: representationTypes
      });
      
    if (error) {
      console.error('Error processing batch:', error.message);
      break;
    }
    
    totalQueued += result.queued_count;
    totalPosts += result.posts_count;
    totalComments += result.comments_count;
    batchesProcessed++;
    
    console.log(`Batch ${batchesProcessed} results: ${result.queued_count} items queued (${result.posts_count} posts, ${result.comments_count} comments)`);
    
    // Stop if nothing was queued in this batch
    if (result.queued_count === 0) {
      console.log('No more content to process, stopping');
      continueProcessing = false;
    } else {
      // Wait before processing next batch to avoid overwhelming the queue
      console.log(`Waiting ${processDelay/1000} seconds before next batch...`);
      await setTimeout(processDelay);
    }
  }
  
  // Get final status
  console.log('Fetching final status...');
  
  try {
    // Get representation coverage if available
    const { data: coverageData, error: coverageError } = await supabase
      .rpc('get_representation_coverage');
      
    if (!coverageError && coverageData) {
      console.log('Final representation coverage:');
      console.log(`- Total posts: ${coverageData.post_stats.total_posts}`);
      console.log(`- Total comments: ${coverageData.comment_stats.total_comments}`);
      console.log(`- Posts missing context_enhanced representations: ${coverageData.post_stats.missing_context_enhanced}`);
      console.log(`- Comments missing context_enhanced representations: ${coverageData.comment_stats.missing_context_enhanced}`);
      
      // Show representation counts if available
      if (coverageData.post_stats.representation_counts) {
        console.log('- Post representation counts:', coverageData.post_stats.representation_counts);
      }
      if (coverageData.comment_stats.representation_counts) {
        console.log('- Comment representation counts:', coverageData.comment_stats.representation_counts);
      }
    }
  } catch (error) {
    // Fallback to older status function
    const { data: finalStatus, error: finalStatusError } = await supabase
      .rpc('get_content_representation_status', {
        filter_subreddit: subreddit
      });
      
    if (finalStatusError) {
      console.error('Error getting final status:', finalStatusError.message);
    } else if (finalStatus) {
      console.log('Final status:');
      console.log(`- Posts: ${finalStatus.post_stats.total_posts} total, ${finalStatus.post_stats.posts_with_context_rep} with context enhanced`);
      console.log(`- Comments: ${finalStatus.comment_stats.total_comments} total, ${finalStatus.comment_stats.comments_with_context_rep} with context enhanced`);
      console.log(`- Queue: ${finalStatus.queue_stats.pending_posts + finalStatus.queue_stats.pending_comments} pending, ${finalStatus.queue_stats.processing_posts + finalStatus.queue_stats.processing_comments} processing`);
    }
  }
  
  // Summary
  console.log('\nReprocessing Summary:');
  console.log(`- Total batches processed: ${batchesProcessed}`);
  console.log(`- Total items queued: ${totalQueued} (${totalPosts} posts, ${totalComments} comments)`);
  console.log(`- Items queued per batch: ${(totalQueued / batchesProcessed).toFixed(2)}`);
  console.log(`- Representation types processed: ${representationTypes?.join(', ') || 'context_enhanced'}`);
}

/**
 * Monitor progress of embedding queue and content processing
 */
async function monitorProgress(
  intervalSeconds: number = 30,
  maxDuration: number = 600, // 10 minutes
  subreddit?: string
): Promise<void> {
  const startTime = Date.now();
  let iteration = 0;
  
  console.log(`Starting monitoring at ${new Date().toISOString()}`);
  console.log(`Will check status every ${intervalSeconds} seconds for up to ${maxDuration / 60} minutes`);
  
  while ((Date.now() - startTime) < maxDuration * 1000) {
    iteration++;
    console.log(`\nMonitoring iteration ${iteration} at ${new Date().toISOString()}`);
    
    // Get current status
    const { data: status, error: statusError } = await supabase
      .rpc('get_content_representation_status', {
        filter_subreddit: subreddit
      });
      
    if (statusError) {
      console.error('Error getting status:', statusError.message);
    } else {
      // Calculate percentages
      const postsWithContextPercent = (status.post_stats.posts_with_context_rep / status.post_stats.total_posts * 100).toFixed(2);
      const commentsWithContextPercent = (status.comment_stats.comments_with_context_rep / status.comment_stats.total_comments * 100).toFixed(2);
      
      // Print status
      console.log(`Queue status: ${status.queue_stats.pending_posts + status.queue_stats.pending_comments} pending, ${status.queue_stats.processing_posts + status.queue_stats.processing_comments} processing`);
      console.log(`Posts: ${status.post_stats.posts_with_context_rep}/${status.post_stats.total_posts} with context enhanced (${postsWithContextPercent}%)`);
      console.log(`Comments: ${status.comment_stats.comments_with_context_rep}/${status.comment_stats.total_comments} with context enhanced (${commentsWithContextPercent}%)`);
      
      // Check if queue is emptying
      if (status.queue_stats.pending_posts + status.queue_stats.pending_comments === 0 &&
          status.queue_stats.processing_posts + status.queue_stats.processing_comments === 0) {
        console.log('Queue is empty, processing complete');
        break;
      }
    }
    
    // Wait for next check
    console.log(`Waiting ${intervalSeconds} seconds for next check...`);
    await setTimeout(intervalSeconds * 1000);
  }
  
  console.log(`\nMonitoring complete at ${new Date().toISOString()}`);
  console.log(`Total duration: ${((Date.now() - startTime) / 1000 / 60).toFixed(2)} minutes`);
}

/**
 * Process command line arguments and run appropriate function
 */
async function main(): Promise<void> {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0] || 'process';
  
  // Parse options
  const options: Partial<BatchProcessingOptions> = {};
  
  for (let i = 1; i < args.length; i += 2) {
    const option = args[i];
    const value = args[i + 1];
    
    if (option && value) {
      switch (option) {
        case '--type':
          if (['all', 'posts', 'comments'].includes(value)) {
            options.contentType = value as 'all' | 'posts' | 'comments';
          }
          break;
        case '--batch-size':
          options.batchSize = parseInt(value, 10);
          break;
        case '--delay':
          options.processDelay = parseInt(value, 10);
          break;
        case '--max-batches':
          options.maxBatches = parseInt(value, 10);
          break;
        case '--priority':
          options.priority = parseInt(value, 10);
          break;
        case '--subreddit':
          options.subreddit = value;
          break;
        case '--max-age':
          options.maxAgeHours = parseInt(value, 10);
          break;
        case '--min-age':
          options.minAgeHours = parseInt(value, 10);
          break;
        case '--rep-types':
          options.representationTypes = value.split(',');
          break;
      }
    }
  }
  
  // Merge with defaults
  const finalOptions: BatchProcessingOptions = {
    ...defaultOptions,
    ...options
  };
  
  // Run appropriate command
  switch (command) {
    case 'process':
      await batchReprocessContent(finalOptions);
      break;
    case 'monitor':
      await monitorProgress(
        parseInt(args[1], 10) || 30,
        parseInt(args[2], 10) || 600,
        args[3]
      );
      break;
    case 'process-and-monitor':
      await batchReprocessContent(finalOptions);
      await monitorProgress(30, 600, finalOptions.subreddit);
      break;
    default:
      console.log('Unknown command. Available commands: process, monitor, process-and-monitor');
      console.log('Options:');
      console.log('  --type [all|posts|comments]  Content type to process');
      console.log('  --batch-size [number]        Number of items per batch');
      console.log('  --delay [number]             Milliseconds between batches');
      console.log('  --max-batches [number]       Maximum number of batches');
      console.log('  --priority [number]          Queue priority (1-10)');
      console.log('  --subreddit [string]         Filter by subreddit');
      console.log('  --max-age [hours]            Maximum age in hours');
      console.log('  --min-age [hours]            Minimum age in hours');
      console.log('  --rep-types [types]          Representation types to process');
      console.log('\nExamples:');
      console.log('  node batch-reprocess-content.js process --type posts --batch-size 100 --subreddit travel');
      console.log('  node batch-reprocess-content.js monitor 60 1800 travel');
      break;
  }
}

// Run the script
main()
  .catch(err => {
    console.error('Error running script:', err);
    process.exit(1);
  })
  .finally(() => {
    console.log('Script complete');
  }); 