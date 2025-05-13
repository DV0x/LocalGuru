// @deno-types="npm:@supabase/supabase-js@2.38.4"
import { createClient } from 'npm:@supabase/supabase-js@2.38.4'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

/**
 * Queue Stats API
 * 
 * Provides statistics about the embedding queue for monitoring
 * and dynamic scaling decisions
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    let queueStats;
    
    try {
      // Try to get queue statistics using the database function
      const { data, error } = await supabaseClient.rpc('get_embedding_queue_stats')
      
      if (error) {
        console.error('RPC error:', error.message);
        throw new Error(`RPC Error: ${error.message}`);
      }
      
      queueStats = data;
    } catch (rpcError) {
      console.warn(`Error with get_embedding_queue_stats RPC: ${rpcError.message}`);
      console.log('Falling back to direct query...');
      
      // Fallback to direct queries if RPC fails
      const { count: pendingCount, error: pendingError } = await supabaseClient
        .from('embedding_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
        
      const { count: processingCount, error: processingError } = await supabaseClient
        .from('embedding_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'processing');
        
      const { count: completedCount, error: completedError } = await supabaseClient
        .from('embedding_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');
        
      const { count: failedCount, error: failedError } = await supabaseClient
        .from('embedding_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');
        
      // Get oldest pending job
      const { data: oldestJobs, error: oldestError } = await supabaseClient
        .from('embedding_queue')
        .select('created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);
        
      let oldestPendingJobAgeHours = 0;
      if (oldestJobs && oldestJobs.length > 0 && !oldestError) {
        const oldestTime = new Date(oldestJobs[0].created_at).getTime();
        const currentTime = new Date().getTime();
        oldestPendingJobAgeHours = (currentTime - oldestTime) / (1000 * 60 * 60);
      }
      
      // Get subreddits from pending jobs
      const { data: pendingJobs, error: subredditError } = await supabaseClient
        .from('embedding_queue')
        .select('subreddit')
        .eq('status', 'pending')
        .not('subreddit', 'is', null);
      
      // Count subreddits manually
      const subredditCounts: Record<string, number> = {};
      if (pendingJobs) {
        pendingJobs.forEach(job => {
          if (job.subreddit) {
            subredditCounts[job.subreddit] = (subredditCounts[job.subreddit] || 0) + 1;
          }
        });
      }
      
      // Convert to array of objects for consistent format
      const subredditCountArray = Object.entries(subredditCounts).map(([subreddit, count]) => ({
        subreddit,
        count
      }));
      
      queueStats = {
        pending_count: pendingCount || 0,
        processing_count: processingCount || 0,
        completed_count: completedCount || 0,
        failed_count: failedCount || 0,
        avg_processing_time_ms: 0, // Would need another query
        oldest_pending_job_age_hours: oldestPendingJobAgeHours,
        subreddit_counts: subredditCountArray || []
      };
    }

    // Default values if no data
    const stats = queueStats || {
      pending_count: 0,
      processing_count: 0,
      completed_count: 0,
      failed_count: 0,
      avg_processing_time_ms: 0,
      oldest_pending_job_age_hours: 0,
      subreddit_counts: []
    }

    // Also get processing metrics
    const { data: metrics, error: metricsError } = await supabaseClient
      .from('embedding_metrics')
      .select('id, timestamp, job_type, content_length, chunk_count, processing_time_ms, subreddit, is_successful')
      .order('timestamp', { ascending: false })
      .limit(100)

    if (metricsError) {
      console.warn(`Error fetching metrics: ${metricsError.message}`)
    }

    // Calculate performance metrics
    const performanceMetrics = calculatePerformanceMetrics(metrics || [])

    // Format response
    const response = {
      queue_status: stats,
      performance_metrics: performanceMetrics,
      timestamp: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (error) {
    console.error('Error in queue-stats function:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})

/**
 * Calculate performance metrics from recent job results
 */
function calculatePerformanceMetrics(metrics: any[]) {
  if (!metrics.length) {
    return {
      avg_processing_time_ms: 0,
      avg_chunks_per_job: 0,
      success_rate: 0,
      jobs_per_hour: 0,
      recent_metrics: []
    }
  }

  // Filter to successful jobs
  const successfulJobs = metrics.filter(m => m.is_successful)
  
  // Calculate average processing time
  const avgProcessingTime = successfulJobs.length
    ? successfulJobs.reduce((sum, job) => sum + job.processing_time_ms, 0) / successfulJobs.length
    : 0

  // Calculate average chunks per job
  const avgChunksPerJob = successfulJobs.length
    ? successfulJobs.reduce((sum, job) => sum + job.chunk_count, 0) / successfulJobs.length
    : 0

  // Calculate success rate
  const successRate = metrics.length
    ? (successfulJobs.length / metrics.length) * 100
    : 0

  // Calculate jobs per hour (based on recent metrics timespan)
  let jobsPerHour = 0
  if (metrics.length > 1) {
    const newestTimestamp = new Date(metrics[0].timestamp).getTime()
    const oldestTimestamp = new Date(metrics[metrics.length - 1].timestamp).getTime()
    const timeSpanHours = (newestTimestamp - oldestTimestamp) / (1000 * 60 * 60)
    
    // Only calculate if timespan is meaningful
    if (timeSpanHours > 0.01) { // More than ~36 seconds
      jobsPerHour = metrics.length / timeSpanHours
    }
  }

  // Get metrics for the last hour
  const oneHourAgo = new Date()
  oneHourAgo.setHours(oneHourAgo.getHours() - 1)
  const recentMetrics = metrics.filter(m => 
    new Date(m.timestamp).getTime() > oneHourAgo.getTime()
  )

  return {
    avg_processing_time_ms: Math.round(avgProcessingTime),
    avg_chunks_per_job: parseFloat(avgChunksPerJob.toFixed(2)),
    success_rate: parseFloat(successRate.toFixed(2)),
    jobs_per_hour: parseFloat(jobsPerHour.toFixed(2)),
    recent_metrics: recentMetrics.slice(0, 10) // Return only the 10 most recent
  }
} 