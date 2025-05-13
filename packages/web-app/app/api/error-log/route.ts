import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase/client-server';

// This can run in Edge runtime for better performance
export const runtime = 'edge';

/**
 * Unified error logging endpoint
 * - POST: Log errors to search_performance_logs
 * - GET: Health check and recent error stats
 * - GET with ?test=true: Generate test error
 */
export async function POST(request: Request) {
  console.log('Error log endpoint called (POST)');
  
  try {
    // Parse request body with error handling
    const body = await request.json().catch(e => {
      console.error('Failed to parse request body:', e);
      return {};
    });
    
    console.log('Error log request body:', body);
    
    // Extract log data with validation and defaults
    const {
      query = 'unknown query',
      intent = 'error',
      duration_ms = -1,
      result_count = 0,
      error_message,
      source = 'system-error'
    } = body;
    
    // Validate required fields
    if (!error_message) {
      console.error('Missing required field: error_message');
      return NextResponse.json({ success: false, error: 'Error message is required' }, { status: 400 });
    }
    
    // Ensure limited string lengths to avoid issues
    const payload = {
      query: String(query).substring(0, 500),
      intent: String(intent).substring(0, 100),
      vector_weight: 0.7,
      text_weight: 0.3,
      ef_search: 300,
      duration_ms: Number(duration_ms) || -1,
      result_count: Number(result_count) || 0,
      timed_out: false,
      error_message: String(error_message).substring(0, 1000),
      source: String(source).substring(0, 100)
    };
    
    console.log('Inserting error log with payload:', payload);
    
    // Direct Supabase API call
    const { data, error } = await supabaseAdmin
      .from('search_performance_logs')
      .insert(payload)
      .select();
    
    if (error) {
      console.error('Error API logging failed:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: error
      }, { status: 500 });
    }
    
    console.log('Error log inserted successfully:', data);
    
    return NextResponse.json({ 
      success: true,
      data
    });
  } catch (error) {
    console.error('Exception in error logging API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for health check or test error generation
 */
export async function GET(request: Request) {
  console.log('Error log endpoint called (GET)');
  
  const url = new URL(request.url);
  const isTest = url.searchParams.get('test') === 'true';
  
  // Handle test error generation
  if (isTest) {
    try {
      const errorMessage = url.searchParams.get('message') || 'Simulated error for testing';
      console.log('Generating test error with message:', errorMessage);
      
      // Insert test error directly
      const { data, error } = await supabaseAdmin
        .from('search_performance_logs')
        .insert({
          query: 'TEST_ERROR',
          intent: 'test',
          vector_weight: 0.7,
          text_weight: 0.3,
          ef_search: 300,
          duration_ms: 0,
          result_count: 0,
          timed_out: false,
          error_message: errorMessage,
          source: 'test-error-endpoint'
        })
        .select();
      
      if (error) {
        console.error('Failed to log test error:', error);
        throw new Error(`Failed to log test error: ${error.message}`);
      }
      
      console.log('Test error logged successfully:', data);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Test error was successfully logged',
        error: errorMessage,
        data
      });
    } catch (error) {
      console.error('Error in test endpoint:', error);
      return NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error in test endpoint',
        stack: error instanceof Error ? error.stack : undefined
      }, { status: 500 });
    }
  }
  
  // Handle health check
  try {
    console.log('Performing health check');
    
    // Check if we can connect to the database
    const { data: logData, error: logError } = await supabaseAdmin
      .from('search_performance_logs')
      .select('id, created_at, error_message, source')
      .not('error_message', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (logError) {
      console.error('Error retrieving recent logs:', logError);
    } else {
      console.log(`Retrieved ${logData?.length || 0} recent logs`);
    }
    
    // Get error count for last 24 hours
    const { count: recentErrorCount, error: countError } = await supabaseAdmin
      .from('search_performance_logs')
      .select('*', { count: 'exact', head: true })
      .not('error_message', 'is', null)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    if (countError) {
      console.error('Error retrieving error count:', countError);
    } else {
      console.log(`Found ${recentErrorCount || 0} errors in the last 24 hours`);
    }
    
    // Return status
    return NextResponse.json({
      status: 'ok',
      service: 'error-logging-system',
      database_connected: !logError,
      recent_logs: logData || [],
      error_count_24h: recentErrorCount || 0,
      error: logError || countError ? { 
        log_error: logError?.message, 
        count_error: countError?.message 
      } : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in health check:', error);
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 