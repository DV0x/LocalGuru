#!/usr/bin/env node

/**
 * Build verification script
 * Runs various checks to ensure the build process will work correctly
 */
const fs = require('fs');
const path = require('path');

console.log('Running build verification checks...');

// Check utility files in app/lib
const appUtilsPath = path.resolve(__dirname, 'app/lib/utils');
const topLevelUtilsPath = path.resolve(__dirname, 'lib/utils');

const requiredUtils = [
  'api-response.ts',
  'error-handling.ts',
  'api-key-middleware.ts'
];

console.log('\nChecking app/lib/utils files:');
requiredUtils.forEach(file => {
  const filePath = path.join(appUtilsPath, file);
  const exists = fs.existsSync(filePath);
  console.log(` - ${file}: ${exists ? '✅ Found' : '❌ Not found'}`);
});

console.log('\nChecking lib/utils files:');
requiredUtils.forEach(file => {
  const filePath = path.join(topLevelUtilsPath, file);
  const exists = fs.existsSync(filePath);
  console.log(` - ${file}: ${exists ? '✅ Found' : '❌ Not found'}`);
});

// Check path resolution in tsconfig.json
console.log('\nChecking tsconfig.json path mappings:');
const tsConfig = require('./tsconfig.json');
const hasAppPath = tsConfig.compilerOptions.paths && tsConfig.compilerOptions.paths['@/app/*'];
const hasLibPath = tsConfig.compilerOptions.paths && tsConfig.compilerOptions.paths['@/lib/*'];

console.log(` - @/app/* mapping: ${hasAppPath ? '✅ Found' : '❌ Not found'}`);
console.log(` - @/lib/* mapping: ${hasLibPath ? '✅ Found' : '❌ Not found'}`);

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