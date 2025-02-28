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

async function executeSQL(sql) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('Error executing SQL:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error executing SQL:', error);
    return { success: false, error };
  }
}

async function setupDatabase() {
  console.log('=== Supabase Database Setup ===');
  console.log('Setting up Supabase database with pgvector extension and necessary tables/functions...\n');

  try {
    // First, create the exec_sql function if it doesn't exist
    console.log('Creating exec_sql function...');
    const createExecSqlFn = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql;
        RETURN '{"success": true}'::json;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN json_build_object(
            'success', false,
            'error', SQLERRM
          );
      END;
      $$;
    `;
    
    // Execute the SQL directly using the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ sql: createExecSqlFn }),
    });
    
    if (!response.ok) {
      // If the function doesn't exist yet, we'll create it using direct SQL
      console.log('Creating exec_sql function using direct SQL...');
      
      // Execute each SQL command
      for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        console.log(`Executing command ${i + 1}/${commands.length}...`);
        
        // Execute the SQL directly using the REST API
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ query: command }),
        });
        
        if (!response.ok) {
          console.error(`❌ Error executing command ${i + 1}:`, await response.text());
        } else {
          console.log(`✅ Command ${i + 1} executed successfully`);
        }
      }
    } else {
      // If the function exists, use it to execute the SQL commands
      console.log('exec_sql function exists, using it to execute SQL commands...');
      
      // Execute each SQL command
      for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        console.log(`Executing command ${i + 1}/${commands.length}...`);
        
        const result = await executeSQL(command);
        
        if (!result.success) {
          console.error(`❌ Error executing command ${i + 1}:`, result.error);
        } else {
          console.log(`✅ Command ${i + 1} executed successfully`);
        }
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