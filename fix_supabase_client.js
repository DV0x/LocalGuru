const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('Supabase Client Configuration Fix Script');
console.log('=======================================');

// Check current environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const nextPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('\nCurrent configuration:');
console.log(`SUPABASE_URL: ${supabaseUrl || 'Not set'}`);
console.log(`NEXT_PUBLIC_SUPABASE_URL: ${nextPublicSupabaseUrl || 'Not set'}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY length: ${serviceRoleKey ? serviceRoleKey.length : 'Not set'}`);
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY length: ${anonKey ? anonKey.length : 'Not set'}`);

// Extract project ID from URL if available
let projectId = '';
if (supabaseUrl) {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  projectId = match ? match[1] : '';
  console.log(`\nDetected project ID: ${projectId}`);
}

// Function to validate and fix URL format
function validateAndFixUrls() {
  let issues = 0;
  let suggestions = [];
  
  // Check URL format
  if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
    console.log('❌ SUPABASE_URL must start with https://');
    suggestions.push(`SUPABASE_URL should be: https://${projectId}.supabase.co`);
    issues++;
  }
  
  if (nextPublicSupabaseUrl && !nextPublicSupabaseUrl.startsWith('https://')) {
    console.log('❌ NEXT_PUBLIC_SUPABASE_URL must start with https://');
    suggestions.push(`NEXT_PUBLIC_SUPABASE_URL should be: https://${projectId}.supabase.co`);
    issues++;
  }
  
  // Check URL consistency
  if (supabaseUrl && nextPublicSupabaseUrl && supabaseUrl !== nextPublicSupabaseUrl) {
    console.log('❌ SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL should be the same');
    suggestions.push('Make sure both URL variables point to the same Supabase project');
    issues++;
  }
  
  return { issues, suggestions };
}

// Function to validate API keys
function validateApiKeys() {
  let issues = 0;
  let suggestions = [];
  
  // Check if keys are present
  if (!serviceRoleKey) {
    console.log('❌ SUPABASE_SERVICE_ROLE_KEY is missing');
    suggestions.push('Add your service role key from the Supabase dashboard');
    issues++;
  }
  
  if (!anonKey) {
    console.log('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
    suggestions.push('Add your anon/public key from the Supabase dashboard');
    issues++;
  }
  
  // Check key format (keys should be in a specific format and length)
  if (serviceRoleKey && !serviceRoleKey.startsWith('eyJ')) {
    console.log('❌ SUPABASE_SERVICE_ROLE_KEY has incorrect format');
    suggestions.push('Get a fresh service role key from the Supabase dashboard');
    issues++;
  }
  
  if (anonKey && !anonKey.startsWith('eyJ')) {
    console.log('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY has incorrect format');
    suggestions.push('Get a fresh anon key from the Supabase dashboard');
    issues++;
  }
  
  return { issues, suggestions };
}

// Run validations
console.log('\nValidating Supabase configuration...');
const urlValidation = validateAndFixUrls();
const keyValidation = validateApiKeys();

// Summarize findings
const totalIssues = urlValidation.issues + keyValidation.issues;
const allSuggestions = [...urlValidation.suggestions, ...keyValidation.suggestions];

console.log(`\nFound ${totalIssues} issue(s) that need to be fixed.`);

if (totalIssues > 0) {
  console.log('\nRecommended changes:');
  allSuggestions.forEach((suggestion, index) => {
    console.log(`${index + 1}. ${suggestion}`);
  });
  
  console.log('\nHow to update your configuration:');
  console.log('1. Log into your Supabase dashboard at https://app.supabase.io');
  console.log('2. Select your project');
  console.log('3. Go to Project Settings > API');
  console.log('4. Copy the Project URL, anon key, and service role key');
  console.log('5. Update your .env and .env.local files with these values');
  
  // Provide example .env format
  console.log('\nExample .env format:');
  console.log('------------------');
  console.log(`NEXT_PUBLIC_SUPABASE_URL=https://${projectId || 'your-project-id'}.supabase.co`);
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
  console.log(`SUPABASE_URL=https://${projectId || 'your-project-id'}.supabase.co`);
  console.log('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
} else {
  console.log('\n✅ Supabase configuration looks good!');
  console.log('If you\'re still having issues:');
  console.log('1. Check that your API keys have not been revoked or regenerated');
  console.log('2. Verify your project is active in the Supabase dashboard');
  console.log('3. Ensure your application has the latest @supabase/supabase-js package');
}

// Next.js specific tips
console.log('\nNext.js specific tips:');
console.log('1. Make sure next.config.js is correctly exposing environment variables');
console.log('2. Restart your Next.js server after updating environment variables');
console.log('3. For client components, only use NEXT_PUBLIC_* variables'); 