// Script to set up Supabase database with pgvector extension and necessary tables/functions
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

// Apply the environment variables
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

// Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  }
});

// Read the SQL setup file
const sqlFilePath = path.resolve(process.cwd(), 'lib/supabase/setup-db.sql');
const sqlCommands = fs.readFileSync(sqlFilePath, 'utf8');

// Split the SQL commands by semicolon and filter out empty commands
const commands = sqlCommands
  .split(';')
  .map(cmd => cmd.trim())
  .filter(cmd => cmd.length > 0);

async function setupDatabase() {
  console.log('=== Supabase Database Setup ===');
  console.log('Setting up Supabase database with pgvector extension and necessary tables/functions...\n');

  try {
    // Enable pgvector extension
    console.log('1. Enabling pgvector extension...');
    const { error: extensionError } = await supabase.rpc('enable_pgvector_extension');
    
    if (extensionError) {
      console.error('❌ Error enabling pgvector extension:', extensionError);
      console.log('Attempting to create the function and try again...');
      
      // Try to create the function first
      const { error: functionError } = await supabase.from('_exec_sql').rpc('execute', {
        query: commands[3] + ';' // This should be the enable_pgvector_extension function
      });
      
      if (functionError) {
        console.error('❌ Error creating enable_pgvector_extension function:', functionError);
      } else {
        console.log('✅ Created enable_pgvector_extension function');
        
        // Try enabling again
        const { error: retryError } = await supabase.rpc('enable_pgvector_extension');
        if (retryError) {
          console.error('❌ Error enabling pgvector extension on retry:', retryError);
        } else {
          console.log('✅ pgvector extension enabled successfully');
        }
      }
    } else {
      console.log('✅ pgvector extension enabled successfully');
    }
    
    // Create tables and functions
    console.log('\n2. Creating tables and functions...');
    
    // Execute each SQL command
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      // Skip the enable_pgvector_extension function if we already tried it
      if (i === 3 && extensionError === null) continue;
      
      console.log(`Executing command ${i + 1}/${commands.length}...`);
      
      const { error } = await supabase.from('_exec_sql').rpc('execute', {
        query: command + ';'
      });
      
      if (error) {
        console.error(`❌ Error executing command ${i + 1}:`, error);
      } else {
        console.log(`✅ Command ${i + 1} executed successfully`);
      }
    }
    
    console.log('\n=== Database Setup Complete ===');
    console.log('You can now use the vector search functionality in your application.');
    
  } catch (error) {
    console.error('❌ Failed to set up database:', error);
    process.exit(1);
  }
}

setupDatabase(); 