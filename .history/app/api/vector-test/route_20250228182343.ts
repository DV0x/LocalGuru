import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { generateEmbedding } from '@/lib/openai/embeddings';

/**
 * Test API endpoint to verify Supabase vector search functionality
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse the request body
    const body = await request.json();
    const { query } = body;
    
    if (!query) {
      return NextResponse.json({
        success: false,
        error: 'Query is required',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    // Search for similar posts in Supabase
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 5
    });
    
    if (error) {
      console.error('Error searching for similar posts:', error);
      return NextResponse.json({
        success: false,
        error: error.message || 'Error searching for similar posts',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    
    // Log the query
    await supabase
      .from('queries')
      .insert({
        query,
        embedding,
        results: data,
      });
    
    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in vector search test:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error in vector search test',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 