<think>I need to create a comprehensive plan to optimize their vector search system with structured phases. They want to:
1. Improve search accuracy 
2. Integrate LLM processing for results
3. Implement reranking for better presentation

I'll create a detailed implementation plan that builds on their current progress and incorporates the optimization strategies we've discussed. Each phase should have clear objectives, specific tasks, and expected outcomes.</think># Comprehensive Plan to Optimize Vector Search with LLM Integration

Based on our discussions and your current implementation, here's a detailed phased approach to optimize your vector search system and integrate LLM processing for better result presentation.

## Phase 1: Enhanced Content Representation (3 weeks)

### Week 1: Database Schema Enhancement
1. **Update database schema for rich content representation**
   ```sql
   -- Create multi-part embedding table
   CREATE TABLE IF NOT EXISTS content_representations (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     parent_id TEXT NOT NULL, -- post_id or comment_id
     content_type TEXT NOT NULL, -- 'post' or 'comment'
     representation_type TEXT NOT NULL, -- 'full', 'title', 'body', 'context_enhanced'
     embedding VECTOR(1536),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     CONSTRAINT unique_content_representation UNIQUE (parent_id, content_type, representation_type)
   );
   
   -- Add metadata extraction fields
   ALTER TABLE reddit_posts ADD COLUMN IF NOT EXISTS 
     extracted_entities JSONB DEFAULT '{}';
   ALTER TABLE reddit_posts ADD COLUMN IF NOT EXISTS 
     extracted_topics TEXT[] DEFAULT '{}';
   ALTER TABLE reddit_posts ADD COLUMN IF NOT EXISTS 
     extracted_locations TEXT[] DEFAULT '{}';
   ALTER TABLE reddit_posts ADD COLUMN IF NOT EXISTS 
     semantic_tags TEXT[] DEFAULT '{}';
   
   -- Add similar fields to comments
   ALTER TABLE reddit_comments ADD COLUMN IF NOT EXISTS 
     extracted_entities JSONB DEFAULT '{}';
   ALTER TABLE reddit_comments ADD COLUMN IF NOT EXISTS 
     extracted_topics TEXT[] DEFAULT '{}';
   ALTER TABLE reddit_comments ADD COLUMN IF NOT EXISTS 
     thread_context TEXT; -- Store conversation context
   
   -- Create indexes
   CREATE INDEX IF NOT EXISTS content_representations_parent_idx ON 
     content_representations(parent_id);
   CREATE INDEX IF NOT EXISTS content_representations_embedding_idx ON 
     content_representations USING ivfflat (embedding vector_cosine_ops) 
     WITH (lists = 100);
   ```

2. **Create migration cleanup functions**
   ```sql
   -- Function to refresh all content representations
   CREATE OR REPLACE FUNCTION refresh_content_representations(
     refresh_type TEXT DEFAULT 'all', -- 'all', 'posts', 'comments'
     batch_size INTEGER DEFAULT 100
   ) RETURNS VOID AS $$
   BEGIN
     -- Implementation code to queue items for reprocessing
   END;
   $$ LANGUAGE plpgsql;
   ```

### Week 2: Enhanced Entity Extraction & Metadata
1. **Implement entity extraction Edge Function**
   ```typescript
   // Extract entities, topics, locations from text
   async function extractEntities(text: string): Promise<{
     entities: Record<string, string[]>,
     topics: string[],
     locations: string[]
   }> {
     // Use OpenAI or other models for entity extraction
     // Store structured information about the content
   }
   ```

2. **Implement context-aware embedding generation**
   ```typescript
   async function generateEnhancedEmbedding(
     content: string, 
     contentType: 'post' | 'comment',
     contextInfo: {
       postTitle?: string,
       subreddit?: string,
       parentComments?: string[],
       threadPath?: string[]
     }
   ): Promise<number[]> {
     // Create context-enhanced prompt for better embeddings
     let enhancedContent = '';
     
     if (contentType === 'post') {
       enhancedContent = `Subreddit: r/${contextInfo.subreddit}\nTitle: ${content.title}\nContent: ${content.body}`;
     } else {
       enhancedContent = `Post: ${contextInfo.postTitle}\n`;
       if (contextInfo.parentComments?.length) {
         enhancedContent += `Parent: ${contextInfo.parentComments.join('\n')}\n`;
       }
       enhancedContent += `Comment: ${content}`;
     }
     
     // Generate embedding with enhanced content
     return openaiClient.embeddings.create({
       model: 'text-embedding-3-small',
       input: enhancedContent
     }).then(res => res.data[0].embedding);
   }
   ```

### Week 3: Processing Pipeline Update
1. **Update queue processing for multi-representation**
   ```typescript
   async function processContentItem(
     item: QueueItem
   ): Promise<void> {
     // For each content item, create multiple representations
     // 1. Full content embedding
     // 2. Title-only embedding (for posts)
     // 3. Body-only embedding (for posts)
     // 4. Context-enhanced embedding
     
     // Extract metadata
     const entities = await extractEntities(item.content);
     
     // Store all representations and metadata
   }
   ```

2. **Reprocess existing content**
   ```typescript
   // Script to reprocess content in batches
   async function reprocessExistingContent(): Promise<void> {
     let processed = 0;
     const batchSize = 50;
     
     // Process posts
     let { data: posts } = await supabase
       .from('reddit_posts')
       .select('id, title, content')
       .limit(batchSize);
     
     while (posts && posts.length > 0) {
       // Queue each post for reprocessing
       // Wait for completion
       // Get next batch
     }
     
     // Similar process for comments
   }
   ```

## Phase 2: Advanced Query Understanding & Search (4 weeks)

### Week 1: Query Analysis System
1. **Create query intent classification function**
   ```typescript
   type QueryIntent = 'recommendation' | 'information' | 'comparison' | 'experience' | 'general';
   
   async function analyzeQuery(
     query: string
   ): Promise<{
     entities: Record<string, string[]>,
     topics: string[],
     locations: string[],
     intent: QueryIntent,
     enhancedQueries: string[]
   }> {
     // Extract entities, topics, locations
     const extracted = await extractEntities(query);
     
     // Classify query intent using LLM
     const intent = await classifyQueryIntent(query);
     
     // Generate query variations
     const enhancedQueries = await generateQueryVariations(query, extracted, intent);
     
     return {
       ...extracted,
       intent,
       enhancedQueries
     };
   }
   ```

2. **Implement query expansion**
   ```typescript
   async function expandQuery(
     query: string,
     queryAnalysis: ReturnType<typeof analyzeQuery>
   ): Promise<string[]> {
     // Create variations based on intent
     const variations: string[] = [query]; // Always include original
     
     if (queryAnalysis.intent === 'recommendation') {
       variations.push(`Recommendations for ${queryAnalysis.topics.join(', ')}`);
     }
     
     if (queryAnalysis.locations.length > 0) {
       variations.push(`Information about ${queryAnalysis.topics.join(', ')} in ${queryAnalysis.locations.join(', ')}`);
     }
     
     return variations;
   }
   ```

### Week 2: Multi-Strategy Search Function
1. **Create multi-strategy search function**
   ```sql
   CREATE OR REPLACE FUNCTION multi_strategy_search(
     query_text TEXT,
     query_embedding VECTOR(1536),
     search_config JSONB DEFAULT '{}'
   )
   RETURNS TABLE (
     id TEXT,
     content_type TEXT, -- 'post' or 'comment'
     title TEXT, -- NULL for comments
     content TEXT,
     subreddit TEXT,
     post_id TEXT, -- Same as id for posts
     similarity FLOAT,
     match_strategy TEXT,
     parent_path TEXT[] -- For comments, the path to parent
   )
   LANGUAGE plpgsql
   AS $$
   DECLARE
     similarity_threshold FLOAT := coalesce(search_config->>'similarity_threshold', '0.65')::FLOAT;
     max_results INTEGER := coalesce(search_config->>'max_results', '15')::INTEGER;
     include_comments BOOLEAN := coalesce(search_config->>'include_comments', 'true')::BOOLEAN;
     location_boost FLOAT := 0.15;
     topic_boost FLOAT := 0.1;
   BEGIN
     RETURN QUERY
     
     WITH search_queries AS (
       -- Search against different embedding types with different strategies
       
       -- Strategy 1: Full content match
       SELECT
         cr.parent_id,
         CASE 
           WHEN cr.content_type = 'post' THEN 'post'
           ELSE 'comment'
         END AS content_type,
         1 - (cr.embedding <=> query_embedding) AS similarity,
         'full_content' AS match_strategy
       FROM
         content_representations cr
       WHERE
         cr.representation_type = 'full' AND
         1 - (cr.embedding <=> query_embedding) > similarity_threshold
       
       UNION ALL
       
       -- Strategy 2: Title-focused match (posts only)
       SELECT
         cr.parent_id,
         'post' AS content_type,
         (1 - (cr.embedding <=> query_embedding)) * 1.2 AS similarity, -- Boost title matches
         'title_match' AS match_strategy
       FROM
         content_representations cr
       WHERE
         cr.representation_type = 'title' AND
         cr.content_type = 'post' AND
         1 - (cr.embedding <=> query_embedding) > similarity_threshold
       
       -- Add more strategies as needed
     ),
     
     -- Combine results and apply metadata boosts
     combined_results AS (
       SELECT
         sq.parent_id,
         sq.content_type,
         sq.similarity,
         sq.match_strategy,
         -- Apply location boost
         CASE 
           WHEN sq.content_type = 'post' AND 
                EXISTS (
                  SELECT 1 FROM reddit_posts p, 
                  jsonb_array_elements_text(search_config->'locations') loc
                  WHERE p.id = sq.parent_id AND loc::TEXT = ANY(p.extracted_locations)
                )
           THEN location_boost
           ELSE 0
         END AS location_boost,
         
         -- Apply topic boost
         CASE 
           WHEN sq.content_type = 'post' AND 
                EXISTS (
                  SELECT 1 FROM reddit_posts p, 
                  jsonb_array_elements_text(search_config->'topics') topic
                  WHERE p.id = sq.parent_id AND topic::TEXT = ANY(p.extracted_topics)
                )
           THEN topic_boost
           ELSE 0
         END AS topic_boost
       FROM
         search_queries sq
     ),
     
     -- Calculate final scores
     scored_results AS (
       SELECT
         cr.parent_id,
         cr.content_type,
         cr.similarity + cr.location_boost + cr.topic_boost AS final_score,
         cr.match_strategy
       FROM
         combined_results cr
     ),
     
     -- Get unique results (best score per item)
     unique_results AS (
       SELECT DISTINCT ON (parent_id, content_type)
         parent_id,
         content_type,
         final_score AS similarity,
         match_strategy
       FROM
         scored_results
       ORDER BY
         parent_id, content_type, final_score DESC
     )
     
     -- Join with content tables to get full details
     SELECT
       ur.parent_id AS id,
       ur.content_type,
       CASE WHEN ur.content_type = 'post' THEN p.title ELSE NULL END AS title,
       CASE 
         WHEN ur.content_type = 'post' THEN p.content 
         ELSE c.content
       END AS content,
       CASE 
         WHEN ur.content_type = 'post' THEN p.subreddit 
         ELSE (SELECT subreddit FROM reddit_posts WHERE id = c.post_id)
       END AS subreddit,
       CASE 
         WHEN ur.content_type = 'post' THEN p.id 
         ELSE c.post_id
       END AS post_id,
       ur.similarity,
       ur.match_strategy,
       CASE 
         WHEN ur.content_type = 'comment' THEN c.path 
         ELSE NULL
       END AS parent_path
     FROM
       unique_results ur
     LEFT JOIN
       reddit_posts p ON ur.content_type = 'post' AND ur.parent_id = p.id
     LEFT JOIN
       reddit_comments c ON ur.content_type = 'comment' AND ur.parent_id = c.id
     ORDER BY
       ur.similarity DESC
     LIMIT
       max_results;
     
   END;
   $$;
   ```

### Week 3-4: Edge Function & API Development
1. **Create search Edge Function**
   ```typescript
   // supabase/functions/enhanced-search/index.ts
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
   
   interface SearchRequest {
     query: string;
     options?: {
       maxResults?: number;
       includeComments?: boolean;
       similarityThreshold?: number;
       filterSubreddit?: string;
     };
   }
   
   serve(async (req: Request) => {
     try {
       const { query, options = {} } = await req.json() as SearchRequest;
       
       // Create Supabase client
       const supabaseClient = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_ANON_KEY') ?? '',
         { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
       );
       
       // Analyze query using OpenAI
       const queryAnalysis = await analyzeQuery(query);
       
       // Generate embeddings for query
       const { data: { embedding } } = await supabaseClient.rpc('generate_embeddings', {
         input: query
       });
       
       // Configure search parameters
       const searchConfig = {
         similarity_threshold: options.similarityThreshold || 0.65,
         max_results: options.maxResults || 15,
         include_comments: options.includeComments !== false,
         locations: queryAnalysis.locations,
         topics: queryAnalysis.topics,
         intent: queryAnalysis.intent
       };
       
       // Perform search
       const { data: results, error } = await supabaseClient.rpc(
         'multi_strategy_search',
         {
           query_text: query,
           query_embedding: embedding,
           search_config: searchConfig
         }
       );
       
       if (error) throw error;
       
       // Return results with query analysis
       return new Response(
         JSON.stringify({
           results,
           query: {
             original: query,
             analysis: queryAnalysis
           }
         }),
         { headers: { 'Content-Type': 'application/json' } }
       );
     } catch (error) {
       return new Response(
         JSON.stringify({ error: error.message }),
         { status: 400, headers: { 'Content-Type': 'application/json' } }
       );
     }
   });
   ```

2. **Create Next.js API route**
   ```typescript
   // app/api/search/route.ts
   import { createClient } from '@supabase/supabase-js';
   import { OpenAI } from 'openai';
   
   const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!
   );
   
   const openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY
   });
   
   export async function GET(request: Request) {
     const { searchParams } = new URL(request.url);
     const query = searchParams.get('q') || '';
     
     try {
       // Generate embedding
       const embeddingResponse = await openai.embeddings.create({
         model: 'text-embedding-3-small',
         input: query
       });
       
       const embedding = embeddingResponse.data[0].embedding;
       
       // Call search function
       const { data: results, error } = await supabase.rpc(
         'multi_strategy_search',
         {
           query_text: query,
           query_embedding: embedding,
           search_config: {}
         }
       );
       
       if (error) throw error;
       
       return Response.json({ results });
     } catch (error) {
       console.error('Search error:', error);
       return Response.json({ error: 'Search failed' }, { status: 500 });
     }
   }
   ```

## Phase 3: LLM Integration for Result Processing (3 weeks)

### Week 1: Result Reranking with LLM
1. **Create reranking function**
   ```typescript
   async function rerankResults(
     query: string,
     results: any[],
     queryAnalysis: ReturnType<typeof analyzeQuery>
   ): Promise<any[]> {
     if (results.length <= 3) return results; // Skip for very few results
     
     // Create pairwise preference judgments for most relevant results
     const topResults = results.slice(0, 10);
     
     // Generate judgments using OpenAI
     const prompt = `
       Query: "${query}"
       Intent: ${queryAnalysis.intent}
       Topics: ${queryAnalysis.topics.join(', ')}
       
       For each content pair, decide which is more relevant to the query.
       Content pairs:
       ${topResults.map((r, i) => 
         topResults.slice(i + 1).map(other => 
           `PAIR ${i}-${topResults.indexOf(other)}:
           Content A: ${r.title ? `[${r.title}] ` : ''}${r.content.substring(0, 200)}...
           Content B: ${other.title ? `[${other.title}] ` : ''}${other.content.substring(0, 200)}...`
         ).join('\n\n')
       ).join('\n\n')}
       
       For each pair, respond with just the letter of the more relevant content: A, B, or TIE.
     `;
     
     const completion = await openai.chat.completions.create({
       model: 'gpt-4o',
       messages: [{ role: 'user', content: prompt }]
     });
     
     // Parse judgment results
     const judgments = parseJudgments(completion.choices[0].message.content);
     
     // Apply ranking algorithm based on judgments
     return applyRanking(results, judgments);
   }
   ```

2. **Implement ranking algorithm**
   ```typescript
   function applyRanking(
     results: any[],
     judgments: Record<string, 'A' | 'B' | 'TIE'>
   ): any[] {
     // Calculate scores based on judgments
     const scores = results.map(() => 0);
     
     // For each judgment, update scores
     Object.entries(judgments).forEach(([pair, winner]) => {
       const [indexA, indexB] = pair.split('-').map(Number);
       
       if (winner === 'A') {
         scores[indexA] += 1;
       } else if (winner === 'B') {
         scores[indexB] += 1;
       } else {
         // Tie - both get 0.5
         scores[indexA] += 0.5;
         scores[indexB] += 0.5;
       }
     });
     
     // Combine original similarity with judgment scores
     return results.map((result, i) => ({
       ...result,
       final_score: result.similarity * 0.4 + (scores[i] / Math.max(...scores)) * 0.6
     }))
     .sort((a, b) => b.final_score - a.final_score);
   }
   ```

### Week 2: Result Organization & Structuring
1. **Create result organization function**
   ```typescript
   async function organizeSearchResults(
     query: string,
     results: any[],
     queryAnalysis: ReturnType<typeof analyzeQuery>
   ): Promise<{
     groups: any[],
     highlightedResults: any[]
   }> {
     // Group results by post (for comments)
     const postGroups = {};
     
     results.forEach(result => {
       if (result.content_type === 'comment') {
         const postId = result.post_id;
         if (!postGroups[postId]) {
           postGroups[postId] = {
             post: null,
             comments: [],
             maxSimilarity: 0
           };
         }
         
         postGroups[postId].comments.push(result);
         postGroups[postId].maxSimilarity = Math.max(
           postGroups[postId].maxSimilarity,
           result.similarity
         );
       } else {
         // Store post info if not already present
         if (!postGroups[result.id]) {
           postGroups[result.id] = {
             post: result,
             comments: [],
             maxSimilarity: result.similarity
           };
         } else {
           postGroups[result.id].post = result;
           postGroups[result.id].maxSimilarity = Math.max(
             postGroups[result.id].maxSimilarity,
             result.similarity
           );
         }
       }
     });
     
     // Convert to array and sort by max similarity
     const groups = Object.values(postGroups)
       .sort((a: any, b: any) => b.maxSimilarity - a.maxSimilarity);
     
     // Get top 3 most relevant individual results
     const highlightedResults = results
       .slice(0, 3)
       .map(result => ({
         ...result,
         relevanceExplanation: await generateRelevanceExplanation(query, result)
       }));
     
     return { groups, highlightedResults };
   }
   ```

2. **Generate result insights with LLM**
   ```typescript
   async function generateSearchInsights(
     query: string,
     organizedResults: ReturnType<typeof organizeSearchResults>,
     queryAnalysis: ReturnType<typeof analyzeQuery>
   ): Promise<{
     summaryInsights: string,
     recommendedTopics: string[],
     answerExtract?: string
   }> {
     // Extract content for processing
     const topResults = organizedResults.highlightedResults;
     const allGroups = organizedResults.groups;
     
     // Create content summary for LLM
     const contentForProcessing = topResults
       .map(r => `${r.title ? `[${r.title}] ` : ''}${r.content.substring(0, 300)}...`)
       .join('\n\n');
     
     // Generate insights using OpenAI
     const prompt = `
       Query: "${query}"
       Intent: ${queryAnalysis.intent}
       Topics: ${queryAnalysis.topics.join(', ')}
       
       Top relevant content:
       ${contentForProcessing}
       
       Based on these search results:
       1. Generate a brief summary of the key insights relevant to the query
       2. Suggest 3-5 related topics the user might want to explore
       3. If the query is a direct question, extract a concise answer if possible
       
       Format your response as JSON:
       {
         "summaryInsights": "...",
         "recommendedTopics": ["topic1", "topic2", ...],
         "answerExtract": "..." // only if query is a question
       }
     `;
     
     const completion = await openai.chat.completions.create({
       model: 'gpt-4o',
       messages: [{ role: 'user', content: prompt }],
       response_format: { type: 'json_object' }
     });
     
     return JSON.parse(completion.choices[0].message.content);
   }
   ```

### Week 3: Result Presentation API
1. **Create enhanced search API**
   ```typescript
   // app/api/enhanced-search/route.ts
   import { createClient } from '@supabase/supabase-js';
   import { OpenAI } from 'openai';
   
   export async function GET(request: Request) {
     const { searchParams } = new URL(request.url);
     const query = searchParams.get('q') || '';
     const processingLevel = searchParams.get('processing') || 'basic'; // basic, rerank, full
     
     try {
       // 1. Analyze query
       const queryAnalysis = await analyzeQuery(query);
       
       // 2. Generate embedding
       const embedding = await generateEmbedding(query);
       
       // 3. Perform search
       const results = await performSearch(query, embedding, queryAnalysis);
       
       // 4. Process results based on level
       let processedResults;
       if (processingLevel === 'basic') {
         processedResults = {
           results,
           queryAnalysis
         };
       } else if (processingLevel === 'rerank') {
         const rerankedResults = await rerankResults(query, results, queryAnalysis);
         processedResults = {
           results: rerankedResults,
           queryAnalysis
         };
       } else {
         // Full processing
         const rerankedResults = await rerankResults(query, results, queryAnalysis);
         const organizedResults = await organizeSearchResults(query, rerankedResults, queryAnalysis);
         const insights = await generateSearchInsights(query, organizedResults, queryAnalysis);
         
         processedResults = {
           organizedResults,
           insights,
           queryAnalysis
         };
       }
       
       return Response.json(processedResults);
     } catch (error) {
       console.error('Enhanced search error:', error);
       return Response.json({ error: 'Search failed' }, { status: 500 });
     }
   }
   ```

2. **Create structured result component**
   ```tsx
   // app/components/structured-search-results.tsx
   'use client';
   
   import React from 'react';
   import { useQuery } from '@tanstack/react-query';
   
   interface SearchResultsProps {
     query: string;
     processingLevel?: 'basic' | 'rerank' | 'full';
   }
   
   export default function StructuredSearchResults({ 
     query, 
     processingLevel = 'full' 
   }: SearchResultsProps) {
     const { data, isLoading, error } = useQuery({
       queryKey: ['enhanced-search', query, processingLevel],
       queryFn: async () => {
         if (!query) return null;
         const response = await fetch(
           `/api/enhanced-search?q=${encodeURIComponent(query)}&processing=${processingLevel}`
         );
         if (!response.ok) throw new Error('Search failed');
         return response.json();
       },
       enabled: !!query
     });
     
     if (isLoading) return <div className="animate-pulse">Loading results...</div>;
     if (error) return <div className="text-red-500">Error: {error.message}</div>;
     if (!data) return null;
     
     // Render based on processing level
     if (processingLevel === 'full') {
       return (
         <div className="space-y-8">
           {/* Insights section */}
           {data.insights && (
             <div className="bg-gray-50 p-4 rounded-lg">
               <h3 className="font-medium text-lg">Key Insights</h3>
               <p className="mt-2">{data.insights.summaryInsights}</p>
               
               {data.insights.answerExtract && (
                 <div className="mt-4 border-l-4 border-blue-500 pl-4">
                   <h4 className="font-medium">Direct Answer</h4>
                   <p>{data.insights.answerExtract}</p>
                 </div>
               )}
               
               {data.insights.recommendedTopics?.length > 0 && (
                 <div className="mt-4">
                   <h4 className="font-medium">Related Topics</h4>
                   <div className="flex flex-wrap gap-2 mt-1">
                     {data.insights.recommendedTopics.map(topic => (
                       <span key={topic} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                         {topic}
                       </span>
                     ))}
                   </div>
                 </div>
               )}
             </div>
           )}
           
           {/* Results groups */}
           <div className="space-y-6">
             {data.organizedResults.groups.map((group, i) => (
               <div key={i} className="border rounded-lg overflow-hidden">
                 {/* Post header */}
                 {group.post && (
                   <div className="bg-white p-4 border-b">
                     <h3 className="font-medium text-lg">{group.post.title}</h3>
                     <div className="text-sm text-gray-500 mt-1">
                       r/{group.post.subreddit} • Match score: {(group.maxSimilarity * 100).toFixed(1)}%
                     </div>
                     <p className="mt-2 text-gray-700 line-clamp-3">{group.post.content}</p>
                   </div>
                 )}
                 
                 {/* Comments */}
                 {group.comments.length > 0 && (
                   <div className="divide-y">
                     {group.comments.slice(0, 3).map((comment, j) => (
                       <div key={j} className="p-4 bg-gray-50">
                         <p className="text-gray-800">{comment.content}</p>
                         <div className="text-xs text-gray-500 mt-2">
                           Match score: {(comment.similarity * 100).toFixed(1)}%
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             ))}
           </div>
         </div>
       );
     } else {
       // Basic rendering for other processing levels
       return (
         <div className="space-y-4">
           {data.results.map((result, i) => (
             <div key={i} className="border rounded p-4">
               {result.title && <h3 className="font-medium">{result.title}</h3>}
               <p className="mt-2 text-gray-700">{result.content.substring(0, 200)}...</p>
               <div className="text-xs text-gray-500 mt-2">
                 r/{result.subreddit} • Match score: {(result.similarity * 100).toFixed(1)}%
               </div>
             </div>
           ))}
         </div>
       );
     }
   }
   ```

## Phase 4: Evaluation & Optimization (2 weeks)

### Week 1: Evaluation Framework
1. **Create test query set**
   ```typescript
   // scripts/evaluation/test-queries.ts
   export const testQueries = [
     {
       id: 'food-1',
       query: 'Best Indian food in SF',
       relevantIds: ['postId1', 'postId2', 'commentId1'], // Known relevant content
       categories: ['location', 'recommendation', 'food'],
     },
     {
       id: 'tech-1',
       query: 'How does the Rust borrow checker work?',
       relevantIds: ['postId3', 'commentId2', 'commentId3'],
       categories: ['technical', 'explanation', 'programming'],
     },
     // Add 15-20 more diverse queries
   ];
   ```

2. **Implement evaluation script**
   ```typescript
   // scripts/evaluation/run-evaluation.ts
   import { testQueries } from './test-queries';
   import { createClient } from '@supabase/supabase-js';
   import { OpenAI } from 'openai';
   
   // Initialize clients
   const supabase = createClient(
     process.env.SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!
   );
   
   const openai = new OpenAI({
     apiKey: process.env.OPENAI_API_KEY
   });
   
   async function evaluateSearch(
     processingLevel: 'basic' | 'rerank' | 'full' = 'basic'
   ): Promise<{
     overall: {
       precisionAt5: number;
       recallAt10: number;
       ndcgAt10: number;
       mrr: number;
       averageQueryTime: number;
     },
     byQuery: Record<string, any>
   }> {
     const results = {
       overall: {
         precisionAt5: 0,
         recallAt10: 0,
         ndcgAt10: 0,
         mrr: 0,
         averageQueryTime: 0
       },
       byQuery: {}
     };
     
     const queryTimes: number[] = [];
     
     // Run each test query
     for (const testQuery of testQueries) {
       const startTime = Date.now();
       
       // Generate embedding
       const embeddingResponse = await openai.embeddings.create({
         model: 'text-embedding-3-small',
         input: testQuery.query
       });
       
       const embedding = embeddingResponse.data[0].embedding;
       
       // Run search
       const { data: searchResults } = await supabase.rpc(
         'multi_strategy_search',
         {
           query_text: testQuery.query,
           query_embedding: embedding,
           search_config: {}
         }
       );
       
       // Process results if needed
       let processedResults = searchResults;
       if (processingLevel !== 'basic') {
         // Apply appropriate processing
         // ...
       }
       
       const endTime = Date.now();
       queryTimes.push(endTime - startTime);
       
       // Calculate metrics
       const precisionAt5 = calculatePrecision(processedResults.slice(0, 5), testQuery.relevantIds);
       const recallAt10 = calculateRecall(processedResults.slice(0, 10), testQuery.relevantIds);
       const ndcgAt10 = calculateNDCG(processedResults.slice(0, 10), testQuery.relevantIds);
       const mrr = calculateMRR(processedResults, testQuery.relevantIds);
       
       // Store results
       results.byQuery[testQuery.id] = {
         precisionAt5,
         recallAt10,
         ndcgAt10,
         mrr,
         queryTime: endTime - startTime
       };
     }
     
     // Calculate overall metrics
     results.overall = {
       precisionAt5: average(Object.values(results.byQuery).map(r => r.precisionAt5)),
       recallAt10: average(Object.values(results.byQuery).map(r => r.recallAt10)),
       ndcgAt10: average(Object.values(results.byQuery).map(r => r.ndcgAt10)),
       mrr: average(Object.values(results.byQuery).map(r => r.mrr)),
       averageQueryTime: average(queryTimes)
     };
     
     return results;
   }
   
   // Helper functions for metric calculation
   function calculatePrecision(results, relevantIds) {
     // Implementation
   }
   
   function calculateRecall(results, relevantIds) {
     // Implementation
   }
   
   function calculateNDCG(results, relevantIds) {
     // Implementation
   }
   
   function calculateMRR(results, relevantIds) {
     // Implementation
   }
   
   function average(values) {
     return values.reduce((a, b) => a + b, 0) / values.length;
   }
   
   // Run evaluation
   async function main() {
     console.log('Running basic evaluation...');
     const basicResults = await evaluateSearch('basic');
     console.log('Basic search results:', basicResults.overall);
     
     console.log('Running reranked evaluation...');
     const rerankResults = await evaluateSearch('rerank');
     console.log('Reranked search results:', rerankResults.overall);
     
     console.log('Running full evaluation...');
     const fullResults = await evaluateSearch('full');
     console.log('Full search results:', fullResults.overall);
   }
   
   main();
   ```

### Week 2: Parameter Tuning & Optimization
1. **Implement parameter tuning script**
   ```typescript
   // scripts/optimization/parameter-tuning.ts
   import { testQueries } from '../evaluation/test-queries';
   import { evaluateSearch } from '../evaluation/run-evaluation';
   
   // Parameter ranges to test
   const parameterRanges = {
     similarityThreshold: [0.55, 0.6, 0.65, 0.7, 0.75],
     titleBoost: [1.0, 1.1, 1.2, 1.3, 1.4],
     locationBoost: [0.1, 0.15, 0.2, 0.25],
     topicBoost: [0.05, 0.1, 0.15, 0.2]
   };
   
   async function findOptimalParameters(): Promise<{
     bestParameters: Record<string, number>,
     bestScore: number,
     allResults: Record<string, any>
   }> {
     let bestParameters = {};
     let bestScore = 0;
     const allResults = {};
     
     // Grid search over parameter combinations
     // This is a simplified version - in practice, you would use a more efficient search method
     for (const similarityThreshold of parameterRanges.similarityThreshold) {
       for (const titleBoost of parameterRanges.titleBoost) {
         for (const locationBoost of parameterRanges.locationBoost) {
           for (const topicBoost of parameterRanges.topicBoost) {
             const parameters = {
               similarityThreshold,
               titleBoost,
               locationBoost,
               topicBoost
             };
             
             // Update search config with these parameters
             // This assumes you've modified the evaluation function to accept parameters
             const results = await evaluateSearch('rerank', parameters);
             
             // Calculate combined score (you can adjust weights based on priorities)
             const score = 

##<think>Let me analyze what we've implemented so far compared to the comprehensive optimization plan in search_optimization_plan.md.

The plan outlines four main phases:
1. Phase 1: Enhanced Content Representation (3 weeks)
2. Phase 2: Advanced Query Understanding & Search (4 weeks)
3. Phase 3: LLM Integration for Result Processing (3 weeks)
4. Phase 4: Evaluation & Optimization (2 weeks)

Let me go through each phase and identify what we've implemented versus what still needs to be done.</think># Vector Search Implementation Progress Report

After reviewing our current implementation against the comprehensive optimization plan, here's a breakdown of what we've accomplished and what remains to be done:

## Phase 1: Enhanced Content Representation (3 weeks)

### ✅ Completed
- Created basic database schema for Reddit posts and comments
- Implemented the `content_chunks` table for storing content fragments
- Created `content_representations` table for multiple representation types (full, title, body)
- Set up basic embedding generation using OpenAI
- Implemented chunking for long posts
- Added embedding storage in PostgreSQL vector columns

### 🚫 Not Yet Implemented
- Enhanced entity extraction (topics, locations, semantic tags)
- Context-aware embedding generation
- Thread-aware comment representation
- Multi-representation processing pipeline (full, title, body, context_enhanced)
- Migration cleanup functions for reprocessing content

## Phase 2: Advanced Query Understanding & Search (4 weeks)

### ✅ Completed
- Basic vector similarity search
- Fallback text search

### 🚫 Not Yet Implemented
- Query intent classification
- Query expansion/variation generation
- Multi-strategy search with multiple embedding types
- Metadata-based boosting (location, topic)
- Enhanced search Edge Function with query analysis
- Next.js API route for enhanced search

## Phase 3: LLM Integration for Result Processing (3 weeks)

### ✅ Completed
- Very minimal JSON response formatting

### 🚫 Not Yet Implemented
- Result reranking with LLM
- Result organization by conversation thread
- LLM-generated result insights
- Structured presentation components
- Enhanced search API with processing levels

## Phase 4: Evaluation & Optimization (2 weeks)

### ✅ Completed
- Basic manual testing

### 🚫 Not Yet Implemented
- Formal evaluation framework
- Test query set creation
- Metric calculation (precision, recall, NDCG)
- Parameter tuning scripts
- Performance optimization

## Where We Stand Now

We're currently in the early stages of Phase 1. We've implemented the basic infrastructure for:
1. Storing Reddit content
2. Generating basic embeddings
3. Performing simple vector searches
4. Handling long content through chunking

## Recommended Next Steps

To make the most impactful progress, I recommend focusing on these high-priority items:

1. **Complete Phase 1**:
   - Implement context-enhanced embedding generation
   - Update our processing pipeline for multi-representation types
   - Add basic metadata extraction

2. **Begin Phase 2**:
   - Implement simple query analysis
   - Create the multi-strategy search function
   - Add basic metadata-based boosting

3. **Minimum Viable Phase 3**:
   - Implement basic result organization by thread
   - Create a simple result formatting function

This approach would give you a significantly improved search experience while laying the groundwork for more advanced LLM-powered features.

Would you like to focus on implementing any specific component from this list first?
