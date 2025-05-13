import { supabaseAdmin } from '@/app/lib/supabase/client-server';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * System-wide health check endpoint
 * Provides comprehensive health metrics for the entire application
 */
export async function GET() {
  try {
    const startTime = Date.now();
    
    // Check database connection
    const { data: dbCheck, error: dbError } = await supabaseAdmin
      .from('reddit_posts')
      .select('id')
      .limit(1);
    
    // Get search statistics from the last 24 hours
    const { data: searchStats, error: searchError } = await supabaseAdmin.rpc(
      'get_search_statistics',
      {
        hours_ago: 24
      }
    );
    
    // Get counts for the last hour
    const { count: recentCount, error: recentSearchError } = await supabaseAdmin
      .from('search_performance_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    
    // Get error counts for the last 24 hours
    const { count: errorCount, error: errorStatsError } = await supabaseAdmin
      .from('search_performance_logs')
      .select('*', { count: 'exact', head: true })
      .not('error_message', 'is', null)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: !dbError && dbCheck !== null,
        error: dbError ? dbError.message : null
      },
      search_stats: {
        last_24h: searchStats ? {
          total_searches: searchStats.total_count,
          avg_duration_ms: Math.round(searchStats.avg_duration),
          max_duration_ms: searchStats.max_duration,
          min_duration_ms: searchStats.min_duration,
          timeout_count: searchStats.timeout_count
        } : null,
        last_hour: {
          total_searches: recentCount || 0
        }
      },
      error_stats: {
        last_24h: {
          error_count: errorCount || 0
        }
      },
      timings: {
        health_check_ms: duration
      },
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        error_logging: {
          status: 'ok',
          url: '/api/error-log'
        }
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, {
      status: 500
    });
  }
}

/**
 * Also handle POST requests to this endpoint for compatibility
 */
export async function POST() {
  return new Response(JSON.stringify({
    success: true,
    service: 'healthcheck',
    message: 'System is operational'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
} 