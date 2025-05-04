require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read and fix environment variables
function fixEnvironmentFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File ${filePath} not found, skipping.`);
      return;
    }

    console.log(`Reading ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');

    // Fix database URL encoding
    if (content.includes('SUPABASE_DB_URL=postgresql://')) {
      content = content.replace(
        /(SUPABASE_DB_URL=postgresql:\/\/[^:]+:)([^@]+)(@[^\/]+\/[^\n]+)/g, 
        (match, prefix, password, suffix) => {
          // Only encode if not already encoded
          if (password.includes('@') && !password.includes('%40')) {
            return `${prefix}${encodeURIComponent(password)}${suffix}`;
          }
          return match;
        }
      );
    }

    // Clean up duplicates
    const envVars = {};
    const lines = content.split('\n').filter(line => {
      if (line.trim() === '' || line.startsWith('#')) return true;
      
      const match = line.match(/^([^=]+)=(.*)$/);
      if (!match) return true;
      
      const [, key, value] = match;
      if (envVars[key]) {
        // Skip duplicate
        return false;
      }
      
      envVars[key] = value;
      return true;
    });

    // Write back cleaned content
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`✅ Fixed and cleaned ${filePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Copy environment to specific locations needed by different parts of the app
function propagateEnvironment() {
  try {
    // Source environment file
    const sourceEnvPath = path.resolve(process.cwd(), '.env.local');
    
    if (!fs.existsSync(sourceEnvPath)) {
      console.log('Source .env.local not found. Cannot propagate.');
      return;
    }
    
    const content = fs.readFileSync(sourceEnvPath, 'utf8');
    
    // Target locations
    const targets = [
      '.env',
      'embedding-processor/.env',
      'queue-processor/.env'
    ];
    
    for (const target of targets) {
      const targetPath = path.resolve(process.cwd(), target);
      const targetDir = path.dirname(targetPath);
      
      // Ensure directory exists
      if (!fs.existsSync(targetDir)) {
        console.log(`Directory for ${target} doesn't exist. Skipping.`);
        continue;
      }
      
      fs.writeFileSync(targetPath, content, 'utf8');
      console.log(`✅ Updated ${target}`);
    }
    
    console.log('✅ Environment propagated to all necessary locations');
  } catch (error) {
    console.error('Error propagating environment:', error.message);
  }
}

// Test Supabase connection with both key types
async function testSupabaseConnection() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (!url) {
    console.log('❌ No Supabase URL found in environment');
    return false;
  }
  
  // Test service role key
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    try {
      console.log('Testing connection with service role key...');
      const supabaseAdmin = createClient(url, serviceRoleKey);
      const { data, error } = await supabaseAdmin.from('reddit_posts').select('id').limit(1);
      
      if (!error) {
        console.log('✅ Service role key connection successful!');
        console.log(data ? `Found ${data.length} results` : 'No data returned but connection worked');
        return true;
      } else {
        console.log('❌ Service role key connection failed:', error.message);
      }
    } catch (error) {
      console.error('Error with service role connection:', error.message);
    }
  } else {
    console.log('❌ No service role key found');
  }
  
  // Test anon key
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey) {
    try {
      console.log('Testing connection with anon key...');
      const supabaseClient = createClient(url, anonKey);
      const { data, error } = await supabaseClient.from('reddit_posts').select('id').limit(1);
      
      if (!error) {
        console.log('✅ Anon key connection successful!');
        console.log(data ? `Found ${data.length} results` : 'No data returned but connection worked');
        return true;
      } else {
        console.log('❌ Anon key connection failed:', error.message);
      }
    } catch (error) {
      console.error('Error with anon key connection:', error.message);
    }
  } else {
    console.log('❌ No anon key found');
  }
  
  return false;
}

// Main function
async function main() {
  console.log('LocalGuru Environment Fix Tool');
  console.log('=============================');
  
  // Fix environment files
  console.log('\nStep 1: Fixing environment files...');
  fixEnvironmentFile('.env');
  fixEnvironmentFile('.env.local');
  
  // Propagate environment to all locations
  console.log('\nStep 2: Propagating environment to all app components...');
  propagateEnvironment();
  
  // Test connection
  console.log('\nStep 3: Testing Supabase connection...');
  const connectionOk = await testSupabaseConnection();
  
  if (connectionOk) {
    console.log('\n✅ Connection fixed successfully!');
    console.log('You can now run your application with: npm run dev');
  } else {
    console.log('\n❌ Connection issues remain. Please check:');
    console.log('1. Your API keys - they may be outdated or incorrect');
    console.log('2. Your IP might be blocked by Supabase');
    console.log('3. Database credentials might be incorrect');
    console.log('\nTry visiting your Supabase dashboard to get fresh API keys.');
  }
}

main();