require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const https = require('https');

// Check Supabase connection directly
async function checkSupabaseConnection() {
  try {
    console.log('1. Testing direct Supabase connection...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log(`   URL: ${supabaseUrl}`);
    console.log(`   Key: ${supabaseKey.substring(0, 10)}...`);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('reddit_posts').select('id').limit(1);
    
    if (error) {
      console.log(`❌ Supabase connection failed: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Supabase connection successful! Found ${data ? data.length : 0} records.`);
    return true;
  } catch (error) {
    console.log(`❌ Supabase connection error: ${error.message}`);
    return false;
  }
}

// Check local development server
function checkLocalServer() {
  return new Promise((resolve) => {
    console.log('\n2. Testing connection to local development server...');
    
    const req = http.get('http://localhost:3000', (res) => {
      const { statusCode } = res;
      
      console.log(`   Status code: ${statusCode}`);
      
      if (statusCode === 200) {
        console.log('✅ Local server is running and responding');
        resolve(true);
      } else {
        console.log(`❌ Local server returned non-200 status code: ${statusCode}`);
        resolve(false);
      }
      
      // Consume response data to free up memory
      res.resume();
    });
    
    req.on('error', (e) => {
      console.log(`❌ Cannot connect to local server: ${e.message}`);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log('❌ Request to local server timed out after 5 seconds');
      resolve(false);
    });
  });
}

// Check API endpoints
function checkApiEndpoint(endpoint) {
  return new Promise((resolve) => {
    console.log(`\n3. Testing API endpoint: ${endpoint}...`);
    
    const req = http.get(`http://localhost:3000/api/${endpoint}`, (res) => {
      const { statusCode } = res;
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`   Status code: ${statusCode}`);
        
        if (statusCode === 200) {
          console.log(`✅ API endpoint ${endpoint} is responding`);
          try {
            const parsedData = JSON.parse(data);
            console.log(`   Response: ${JSON.stringify(parsedData).substring(0, 100)}...`);
          } catch (e) {
            console.log(`   Response is not valid JSON: ${data.substring(0, 100)}...`);
          }
          resolve(true);
        } else {
          console.log(`❌ API endpoint returned non-200 status code: ${statusCode}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (e) => {
      console.log(`❌ Cannot connect to API endpoint: ${e.message}`);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.log('❌ Request to API endpoint timed out after 5 seconds');
      resolve(false);
    });
  });
}

// Check database connection string encoding
function checkDbUrlEncoding() {
  console.log('\n4. Checking database URL encoding...');
  
  const dbUrl = process.env.SUPABASE_DB_URL;
  
  if (!dbUrl) {
    console.log('❌ SUPABASE_DB_URL is not defined');
    return false;
  }
  
  console.log(`   DB URL: ${dbUrl.substring(0, 40)}...`);
  
  if (dbUrl.includes('@') && !dbUrl.includes('%40')) {
    console.log('❌ SUPABASE_DB_URL contains unencoded @ character');
    return false;
  } else if (dbUrl.includes('%40')) {
    console.log('✅ SUPABASE_DB_URL has properly encoded @ character');
    return true;
  } else {
    console.log('✅ SUPABASE_DB_URL does not contain @ characters');
    return true;
  }
}

// Main function to run all checks
async function runAllChecks() {
  console.log('LocalGuru Health Check Tool');
  console.log('==========================');
  
  const supabaseOk = await checkSupabaseConnection();
  const serverOk = await checkLocalServer();
  const healthcheckOk = await checkApiEndpoint('healthcheck');
  const dbUrlOk = checkDbUrlEncoding();
  
  console.log('\nSummary:');
  console.log(`Supabase Connection: ${supabaseOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`Local Server: ${serverOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`API Healthcheck: ${healthcheckOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`Database URL Encoding: ${dbUrlOk ? '✅ OK' : '❌ Failed'}`);
  
  console.log('\nOverall status:');
  if (supabaseOk && dbUrlOk) {
    console.log('✅ Core database connection is working');
    
    if (!serverOk || !healthcheckOk) {
      console.log('⚠️  But there are issues with the web application');
      console.log('\nTroubleshooting tips:');
      console.log('1. Make sure the development server is running (npm run dev)');
      console.log('2. Check for any errors in the development server console');
      console.log('3. Restart the development server');
    } else {
      console.log('✅ Application is fully operational');
    }
  } else {
    console.log('❌ Core database connection is not working');
    console.log('\nTroubleshooting tips:');
    console.log('1. Double-check your API keys in the .env.local file');
    console.log('2. Ensure your IP address is allowed in Supabase');
    console.log('3. Verify that the Supabase project is active');
  }
}

// Run the checks
runAllChecks();