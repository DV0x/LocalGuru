#!/usr/bin/env node

/**
 * This script migrates required files from app/lib to the top-level lib directory
 * and updates import paths in API routes
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
    
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Copied ${sourcePath} to ${targetPath}`);
  });
});

// Update imports in all API route files
const apiDir = 'app/api';
const updateImports = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      updateImports(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
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

updateImports(apiDir);

console.log('Migration completed successfully.'); 