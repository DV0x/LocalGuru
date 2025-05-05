#!/usr/bin/env node

/**
 * This script migrates required files from app/lib to the top-level lib directory
 * and updates import paths in API routes and other directories
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directories to copy
const directoriesToCopy = [
  'utils',
  'supabase',
  'search',
  'prompts',
  'validators',
  'llm'
];

// Create the lib directory if it doesn't exist
if (!fs.existsSync('lib')) {
  fs.mkdirSync('lib');
}

// Copy directories
directoriesToCopy.forEach(dir => {
  const sourceDir = path.join('app/lib', dir);
  const targetDir = path.join('lib', dir);
  
  if (!fs.existsSync(sourceDir)) {
    console.log(`Source directory ${sourceDir} does not exist. Skipping.`);
    return;
  }
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Copy all files from source to target
  const files = fs.readdirSync(sourceDir);
  files.forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    // Skip directories
    if (fs.statSync(sourcePath).isDirectory()) {
      return;
    }
    
    // Read file content and update imports before copying
    let content = fs.readFileSync(sourcePath, 'utf8');
    const updatedContent = content.replace(/@\/app\/lib\//g, '@/lib/');
    
    fs.writeFileSync(targetPath, updatedContent);
    console.log(`Copied and updated imports in ${sourcePath} to ${targetPath}`);
  });
});

// Update imports in files
const updateImportsInDirectory = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      updateImportsInDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Replace @/app/lib with @/lib in imports
      const updatedContent = content.replace(/@\/app\/lib\//g, '@/lib/');
      
      if (content !== updatedContent) {
        fs.writeFileSync(fullPath, updatedContent);
        console.log(`Updated imports in ${fullPath}`);
      }
    }
  }
};

// Update imports in all app subdirectories
console.log('Updating imports in all app subdirectories...');
updateImportsInDirectory('app');

// Update imports in components and hooks
console.log('Updating imports in components and hooks...');
if (fs.existsSync('components')) {
  updateImportsInDirectory('components');
}
if (fs.existsSync('hooks')) {
  updateImportsInDirectory('hooks');
}

// Make sure the verify-imports file is updated
if (fs.existsSync('verify-imports.ts')) {
  let content = fs.readFileSync('verify-imports.ts', 'utf8');
  const updatedContent = content.replace(/@\/app\/lib\//g, '@/lib/');
  fs.writeFileSync('verify-imports.ts', updatedContent);
  console.log('Updated imports in verify-imports.ts');
}

// Create a helper file to explicitly link the app/lib to lib
// This can help with transitive dependencies
const helperContent = `/**
 * This file helps with module resolution by re-exporting everything from the top-level lib
 * It ensures backward compatibility with existing @/app/lib imports
 */

// Re-export all utilities
export * from '@/lib/utils/api-response';
export * from '@/lib/utils/error-handling'; 
export * from '@/lib/utils/api-key-middleware';
export * from '@/lib/utils/csrf';
export * from '@/lib/utils/csrf-middleware';
export * from '@/lib/utils/api-key-validator';

// Re-export Supabase client
export * from '@/lib/supabase/client-server';
export * from '@/lib/supabase/types';

// Re-export search functionality
export * from '@/lib/search/query-processor';
export * from '@/lib/search/result-formatter';
export * from '@/lib/search/stream-processor';
export * from '@/lib/search/streaming-types';
export * from '@/lib/search/types';
`;

// Write helper file to app/lib/index.ts
fs.mkdirSync('app/lib', { recursive: true });
fs.writeFileSync('app/lib/index.ts', helperContent);
console.log('Created helper re-export file at app/lib/index.ts');

console.log('Migration completed successfully.'); 