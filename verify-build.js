#!/usr/bin/env node

/**
 * Build verification script
 * Runs various checks to ensure the build process will work correctly
 */
const fs = require('fs');
const path = require('path');

console.log('Running build verification checks...');

// Check that critical utility files exist
const utilsPath = path.resolve(__dirname, 'app/lib/utils');
const requiredUtils = [
  'api-response.ts',
  'error-handling.ts',
  'api-key-middleware.ts'
];

console.log('\nChecking utility files:');
requiredUtils.forEach(file => {
  const filePath = path.join(utilsPath, file);
  const exists = fs.existsSync(filePath);
  console.log(` - ${file}: ${exists ? '✅ Found' : '❌ Not found'}`);
});

// Check path resolution in tsconfig.json
console.log('\nChecking tsconfig.json path mappings:');
const tsConfig = require('./tsconfig.json');
const hasAppPath = tsConfig.compilerOptions.paths && 
                   (tsConfig.compilerOptions.paths['@/app/*'] || 
                    tsConfig.compilerOptions.paths['@/app/lib/*']);

console.log(` - @/app/* mapping: ${hasAppPath ? '✅ Found' : '❌ Not found'}`);

// Check Next.js config
console.log('\nChecking next.config.js:');
try {
  const nextConfig = require('./next.config.js');
  console.log(` - Module exports: ${nextConfig ? '✅ Found' : '❌ Not found'}`);
  console.log(` - Webpack config: ${nextConfig.webpack ? '✅ Found' : '❌ Not found'}`);
} catch (error) {
  console.log(` - Error loading next.config.js: ${error.message}`);
}

console.log('\nVerification complete. Fix any issues before deploying.'); 