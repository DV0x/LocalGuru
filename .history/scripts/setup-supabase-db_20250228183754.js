// Script to set up Supabase database with pgvector extension and necessary tables/functions
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

// Apply the environment variables
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

// Import the Supabase client functions
// We need to use dynamic import since this is a CommonJS file
async function setupDatabase() {
  try {
    // Dynamically import the ESM module
    const { 
      enablePgvectorExtension, 
      createRedditPostsTable, 
      createQueriesTable, 
      createEmbeddingIndex, 
      createMatchDocumentsFunction 
    } = await import('../lib/supabase/client.js');

    console.log('=== Supabase Database Setup ===');
    console.log('Setting up Supabase database with pgvector extension and necessary tables/functions...\n');

    // Step 1: Enable pgvector extension
    console.log('Step 1: Enabling pgvector extension...');
    const extensionResult = await enablePgvectorExtension();
    if (extensionResult.success) {
      console.log('✅ pgvector extension enabled successfully');
    } else {
      console.error('❌ Failed to enable pgvector extension:', extensionResult.error);
      process.exit(1);
    }

    // Step 2: Create reddit_posts table
    console.log('\nStep 2: Creating reddit_posts table...');
    const postsTableResult = await createRedditPostsTable();
    if (postsTableResult.success) {
      console.log('✅ reddit_posts table created successfully');
    } else {
      console.error('❌ Failed to create reddit_posts table:', postsTableResult.error);
      process.exit(1);
    }

    // Step 3: Create queries table
    console.log('\nStep 3: Creating queries table...');
    const queriesTableResult = await createQueriesTable();
    if (queriesTableResult.success) {
      console.log('✅ queries table created successfully');
    } else {
      console.error('❌ Failed to create queries table:', queriesTableResult.error);
      process.exit(1);
    }

    // Step 4: Create embedding index
    console.log('\nStep 4: Creating embedding index...');
    const indexResult = await createEmbeddingIndex();
    if (indexResult.success) {
      console.log('✅ Embedding index created successfully');
    } else {
      console.error('❌ Failed to create embedding index:', indexResult.error);
      process.exit(1);
    }

    // Step 5: Create match_documents function
    console.log('\nStep 5: Creating match_documents function...');
    const functionResult = await createMatchDocumentsFunction();
    if (functionResult.success) {
      console.log('✅ match_documents function created successfully');
    } else {
      console.error('❌ Failed to create match_documents function:', functionResult.error);
      process.exit(1);
    }

    console.log('\n=== Database Setup Complete ===');
    console.log('You can now use the vector search functionality in your application.');
    console.log('Next step: Run the data ingestion script to populate the database:');
    console.log('  node scripts/ingest-reddit-data.js');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

// Run the setup
setupDatabase(); 