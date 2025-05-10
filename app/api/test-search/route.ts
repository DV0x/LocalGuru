import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase/client-server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const {
      query = 'test query',
      intent = 'test',
      vectorWeight = 0.7,
      textWeight = 0.3,
      efSearch = 300,
      durationMs = 100,
      resultCount = 0,
      timedOut = false,
      source = 'test-api',
      errorMessage = null
    } = body;
    
    // Insert test search log directly into the database
    const { error } = await supabaseAdmin
      .from('search_performance_logs')
      .insert({
        query,
        intent,
        vector_weight: vectorWeight,
        text_weight: textWeight,
        ef_search: efSearch,
        duration_ms: durationMs,
        result_count: resultCount,
        timed_out: timedOut,
        source,
        error_message: errorMessage,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Failed to insert test search log:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, message: 'Test search log recorded successfully' });
  } catch (err) {
    console.error('Error in test-search API:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 