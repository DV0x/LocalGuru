-- Create a schema for search optimization related tables
CREATE SCHEMA IF NOT EXISTS search_opt;

-- Create enum for query intent
DO $$ BEGIN
    CREATE TYPE search_opt.query_intent AS ENUM (
        'recommendation',
        'information',
        'comparison',
        'experience',
        'general'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create table for storing query analysis results
CREATE TABLE IF NOT EXISTS search_opt.query_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    entities JSONB NOT NULL DEFAULT '{}'::jsonb,
    topics TEXT[] NOT NULL DEFAULT '{}'::text[],
    locations TEXT[] NOT NULL DEFAULT '{}'::text[],
    intent search_opt.query_intent NOT NULL DEFAULT 'general',
    enhanced_queries TEXT[] NOT NULL DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id)
);

-- Create index on query for faster lookups
CREATE INDEX IF NOT EXISTS idx_query_analysis_query ON search_opt.query_analysis USING gin (to_tsvector('english', query));

-- Create index on intent for filtering
CREATE INDEX IF NOT EXISTS idx_query_analysis_intent ON search_opt.query_analysis (intent);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_query_analysis_created_at ON search_opt.query_analysis (created_at);

-- Create function to store query analysis
CREATE OR REPLACE FUNCTION search_opt.store_query_analysis(
    p_query TEXT,
    p_entities JSONB,
    p_topics TEXT[],
    p_locations TEXT[],
    p_intent search_opt.query_intent,
    p_enhanced_queries TEXT[],
    p_user_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO search_opt.query_analysis (
        query, 
        entities, 
        topics, 
        locations, 
        intent, 
        enhanced_queries, 
        user_id
    ) VALUES (
        p_query, 
        p_entities, 
        p_topics, 
        p_locations, 
        p_intent, 
        p_enhanced_queries, 
        p_user_id
    ) RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the function and tables
GRANT USAGE ON SCHEMA search_opt TO service_role, anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA search_opt TO service_role;
GRANT SELECT, INSERT ON search_opt.query_analysis TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_opt.store_query_analysis TO service_role, anon, authenticated; 