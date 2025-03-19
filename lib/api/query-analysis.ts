import { createClient } from '@supabase/supabase-js';

export type QueryIntent = 'recommendation' | 'information' | 'comparison' | 'experience' | 'general';

export interface QueryAnalysisResult {
  id: string;
  entities: Record<string, string[]>;
  topics: string[];
  locations: string[];
  intent: QueryIntent;
}

/**
 * Analyzes a search query to extract entities, topics, locations, and intent
 */
export async function analyzeQuery(
  query: string,
  userId?: string
): Promise<QueryAnalysisResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    const { data, error } = await supabase.functions.invoke('query-analysis', {
      body: {
        query,
        userId,
      },
    });

    if (error) {
      console.error('Error analyzing query:', error);
      throw new Error(`Failed to analyze query: ${error.message}`);
    }

    return data as QueryAnalysisResult;
  } catch (error) {
    console.error('Error calling query analysis function:', error);
    throw error;
  }
}

/**
 * Server-side function to analyze a query and store the results directly in the database.
 * This can be used in server components or API routes.
 */
export async function analyzeQueryServer(
  query: string,
  userId?: string,
  supabaseClient?: ReturnType<typeof createClient>
): Promise<QueryAnalysisResult> {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  }

  try {
    const { data, error } = await supabaseClient.functions.invoke('query-analysis', {
      body: {
        query,
        userId,
      },
    });

    if (error) {
      console.error('Error analyzing query:', error);
      throw new Error(`Failed to analyze query: ${error.message}`);
    }

    return data as QueryAnalysisResult;
  } catch (error) {
    console.error('Error calling query analysis function:', error);
    throw error;
  }
} 