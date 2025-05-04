#!/usr/bin/env node

/**
 * Script to generate a secure API key for internal endpoints
 * Run with: node scripts/generate-api-key.js
 */

const crypto = require('crypto');

// Generate a secure random API key with 32 bytes (256 bits) of entropy
// This provides a very strong key that is practically impossible to guess
function generateSecureApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Generate and display the key
const apiKey = generateSecureApiKey();

console.log('\n=== SECURE API KEY FOR INTERNAL ENDPOINTS ===');
console.log('\nGenerated API Key:');
console.log(apiKey);
console.log('\nAdd this to your .env.local file as:');
console.log(`INTERNAL_API_KEY=${apiKey}`);
console.log('\nUse this key for authenticating internal service-to-service API calls.');
console.log('Keep this key confidential and do not expose it to client-side code.\n'); 