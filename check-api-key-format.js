require('dotenv').config({ path: '.env.local' });

// Function to validate JWT format
function isValidJWT(token) {
  // Basic JWT format validation
  const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
  return jwtRegex.test(token);
}

// Function to validate API key formatting
function checkApiKey(keyName, keyValue) {
  console.log(`Checking ${keyName}:`);
  
  if (!keyValue) {
    console.log(`❌ ${keyName} is not defined`);
    return false;
  }
  
  // Check JWT format for Supabase keys
  if (keyName.includes('SUPABASE') && keyName.includes('KEY')) {
    if (!isValidJWT(keyValue)) {
      console.log(`❌ ${keyName} does not appear to be a valid JWT format`);
      return false;
    }
    
    // Additionally check if key contains the right project ref
    const projectRef = process.env.SUPABASE_PROJECT || 'ghjbtvyalvigvmuodaas';
    if (!keyValue.includes(projectRef)) {
      console.log(`⚠️ Warning: ${keyName} does not contain the project reference '${projectRef}'`);
    } else {
      console.log(`✅ ${keyName} contains the correct project reference`);
    }
  }
  
  console.log(`✅ ${keyName} format looks valid`);
  return true;
}

// Main function to check all relevant API keys
function checkAllKeys() {
  console.log('LocalGuru API Key Format Checker');
  console.log('===============================\n');
  
  // Check Supabase keys
  checkApiKey('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('');
  checkApiKey('SUPABASE_ANON_KEY', process.env.SUPABASE_ANON_KEY);
  console.log('');
  checkApiKey('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  console.log('');
  
  // Check URL format
  console.log('Checking SUPABASE_URL:');
  const urlPattern = new RegExp('^https://([a-z0-9-]+)\\.supabase\\.co$');
  if (!urlPattern.test(process.env.SUPABASE_URL)) {
    console.log(`❌ SUPABASE_URL format is invalid: ${process.env.SUPABASE_URL}`);
  } else {
    console.log(`✅ SUPABASE_URL format looks valid`);
    
    // Extract project ID from URL and compare with expected
    const match = process.env.SUPABASE_URL.match(urlPattern);
    if (match) {
      const urlProjectId = match[1];
      const configProjectId = process.env.SUPABASE_PROJECT || 'ghjbtvyalvigvmuodaas';
      
      if (urlProjectId !== configProjectId) {
        console.log(`⚠️ Warning: Project ID in URL (${urlProjectId}) doesn't match SUPABASE_PROJECT (${configProjectId})`);
      } else {
        console.log(`✅ Project ID in URL matches expected value`);
      }
    }
  }
  
  // Check database URL
  console.log('\nChecking SUPABASE_DB_URL:');
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.log('❌ SUPABASE_DB_URL is not defined');
  } else {
    if (!dbUrl.includes('%40') && dbUrl.includes('@')) {
      console.log('⚠️ Warning: SUPABASE_DB_URL may have unencoded special characters');
    } else {
      console.log('✅ SUPABASE_DB_URL appears to have proper encoding');
    }
    
    // Check if DB URL contains the project reference
    const projectRef = process.env.SUPABASE_PROJECT || 'ghjbtvyalvigvmuodaas';
    if (!dbUrl.includes(projectRef)) {
      console.log(`⚠️ Warning: SUPABASE_DB_URL does not contain the project reference '${projectRef}'`);
    } else {
      console.log(`✅ SUPABASE_DB_URL contains the correct project reference`);
    }
  }
  
  console.log('\nDone checking API key formats');
}

// Run the checker
checkAllKeys();