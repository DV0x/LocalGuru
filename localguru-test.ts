#!/usr/bin/env node

/**
 * Localguru Test Script
 * 
 * This script tests the complete flow of the Localguru recommendation engine:
 * 1. Query analysis - Determine intent, topics, and locations
 * 2. Query embedding - Convert query to vector embedding
 * 3. Multi-strategy search - Find relevant results based on intent and embedding
 * 
 * Usage: npx ts-node localguru-test.ts --use-docker=false
 */

import { createClient } from '@supabase/supabase-js';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

// Define types based on the project's existing types
type QueryIntent = 'recommendation' | 'information' | 'comparison' | 'experience' | 
                   'local_events' | 'how_to' | 'discovery' | 'general';

interface QueryAnalysisResult {
  entities: Record<string, string[]>;
  topics: string[];
  locations: string[];
  intent: QueryIntent;
}

interface SearchResult {
  id: string;
  title: string;
  content_snippet: string;
  subreddit: string;
  url: string;
  content_type: string;
  similarity: number;
  match_type: string;
}

// Parse command line arguments
const program = new Command();
program
  .option('--use-docker=<bool>', 'Whether to use Docker', 'true')
  .option('--use-pg=<bool>', 'Whether to use direct PostgreSQL connection', 'false')
  .parse(process.argv);

const options = program.opts();
const useDocker = options['use-docker'] !== 'false';
const usePg = options['use-pg'] === 'true';

// Main function
async function main() {
  // Display header
  console.log(chalk.bold.blue('\n🌎 LOCALGURU TEST SCRIPT 🌎'));
  console.log(chalk.gray('Testing the complete recommendation flow\n'));

  // Test query
  const query = "good dating spots in sf";
  console.log(chalk.yellow(`Query: "${query}"`));

  const spinner = ora('Initializing').start();
  
  try {
    // Initialize clients
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    if (!process.env.OPENAI_API_KEY) {
      spinner.fail('Missing OpenAI API key in .env file');
      return;
    }

    // STEP 1: Query Analysis
    spinner.text = 'Analyzing query intent, topics, and locations';
    spinner.start();
    const analysis = await analyzeQuery(query, openai);
    spinner.succeed('Query analysis complete');
    
    console.log(chalk.cyan('\nQuery Analysis Results:'));
    console.log(`Intent: ${chalk.bold(analysis.intent)}`);
    console.log(`Topics: ${chalk.bold(analysis.topics.join(', '))}`);
    console.log(`Locations: ${chalk.bold(analysis.locations.join(', '))}`);
    console.log('Entities:', analysis.entities);
    
    // STEP 2: Generate Query Embedding
    spinner.text = 'Generating query embedding';
    spinner.start();
    const embedding = await generateEmbedding(query, openai);
    spinner.succeed('Query embedding generated');
    
    // STEP 3: Perform multi-strategy search
    spinner.text = 'Performing multi-strategy search';
    spinner.start();
    
    let searchResults: SearchResult[] = [];
    let searchError: any = null;
    
    if (usePg) {
      // Use direct PostgreSQL connection
      try {
        spinner.text = 'Connecting to PostgreSQL directly';
        
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
        });
        
        const client = await pool.connect();
        const result = await client.query(
          'SELECT * FROM public.multi_strategy_search($1, $2, $3, $4, $5, $6, $7)',
          [
            query,
            embedding,
            analysis.intent,
            analysis.topics,
            analysis.locations,
            10, // max results
            0.6  // match threshold
          ]
        );
        
        searchResults = result.rows;
        client.release();
      } catch (error) {
        searchError = error;
      }
    } else {
      // Use Supabase client
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_KEY || '';
      
      if (!supabaseUrl || !supabaseKey) {
        spinner.fail('Missing Supabase credentials in .env file');
        return;
      }
      
      spinner.text = 'Connecting to Supabase';
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data, error } = await supabase.rpc(
        'multi_strategy_search',
        {
          p_query: query,
          p_embedding: embedding,
          p_intent: analysis.intent,
          p_topics: analysis.topics,
          p_locations: analysis.locations,
          p_max_results: 10,
          p_match_threshold: 0.6
        }
      );
      
      searchResults = data || [];
      searchError = error;
    }
    
    if (searchError) {
      spinner.fail(`Search failed: ${searchError.message}`);
      console.error(chalk.red('Error details:'), searchError);
      return;
    }
    
    spinner.succeed('Search complete');
    
    // Display search results
    console.log(chalk.cyan('\nSearch Results:'));
    
    if (!searchResults || searchResults.length === 0) {
      console.log(chalk.yellow('No results found for this query.'));
      return;
    }
    
    searchResults.forEach((result: SearchResult, index: number) => {
      console.log(chalk.bold(`\n${index + 1}. ${result.title}`));
      console.log(chalk.gray(`Source: r/${result.subreddit} | Match: ${result.match_type} | Score: ${(result.similarity * 100).toFixed(1)}%`));
      console.log(chalk.white(result.content_snippet));
      console.log(chalk.blue(`URL: ${result.url}`));
    });
    
    console.log(chalk.green('\n✅ Test completed successfully!'));
    
  } catch (error) {
    spinner.fail('Test failed');
    console.error(chalk.red('Error:'), error);
  }
}

/**
 * Analyze a query to determine intent, topics, and locations
 */
async function analyzeQuery(query: string, openai: OpenAI): Promise<QueryAnalysisResult> {
  // In a real implementation, this would call the Supabase Edge Function
  // For testing, we'll do a direct OpenAI call with the same prompt structure
  
  const prompt = `
Analyze the following search query and extract structured information about it:
"${query}"

Provide your analysis in the following JSON format:
{
  "entities": {
    "product": ["product names mentioned"],
    "brand": ["brand names mentioned"],
    "feature": ["features mentioned"],
    "price_range": ["price ranges mentioned"],
    "attribute": ["any other attributes mentioned"]
  },
  "topics": ["list of general topics this query relates to"],
  "locations": ["any locations mentioned in the query"],
  "intent": "one of: recommendation, information, comparison, experience, local_events, how_to, discovery, general"
}

For "entities", only include categories that are actually present in the query.
For "intent":
- recommendation: user wants suggestions or recommendations
- information: user wants factual information
- comparison: user wants to compare options
- experience: user is asking about personal experiences
- local_events: user is searching for local events or activities in an area
- how_to: user is asking for instructions or guidance on completing a task
- discovery: user is exploring or wanting to discover new options/places
- general: general queries that don't fit the other categories

Pay special attention to dietary preferences (vegan, vegetarian, gluten-free, etc.) and include them in topics.

Provide only the JSON, with no additional text.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });
  
  const result = JSON.parse(response.choices[0].message.content);
  
  // Apply enhanced intent detection for social connection
  if (query.toLowerCase().includes('dating') || query.toLowerCase().includes('date spot')) {
    result.topics = [...new Set([...result.topics, 'dating', 'romantic'])];
    
    if (result.intent !== 'recommendation') {
      result.intent = 'recommendation';
    }
  }
  
  return result;
}

/**
 * Generate vector embedding for a query
 */
async function generateEmbedding(query: string, openai: OpenAI): Promise<number[]> {
  // In a real implementation, this would call the Supabase Edge Function
  // For testing, we'll do a direct OpenAI call
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: query
  });
  
  return response.data[0].embedding;
}

// Run the script
main().catch(console.error); 