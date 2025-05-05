#!/usr/bin/env node

/**
 * This script copies the utility files directly into the app directory structure
 * to ensure they're included in the Vercel build
 */

const fs = require('fs');
const path = require('path');

// Create app/utils directory
if (!fs.existsSync('app/utils')) {
  fs.mkdirSync('app/utils', { recursive: true });
}

// Create search subdirectory
if (!fs.existsSync('app/utils/search')) {
  fs.mkdirSync('app/utils/search', { recursive: true });
}

// Create supabase subdirectory
if (!fs.existsSync('app/utils/supabase')) {
  fs.mkdirSync('app/utils/supabase', { recursive: true });
}

// Copy utility files from utils/ to app/utils/
console.log('Copying utility files to app directory...');
const copyFiles = (sourceDir, targetDir) => {
  if (!fs.existsSync(sourceDir)) {
    console.log(`Source directory ${sourceDir} does not exist`);
    return;
  }
  
  const files = fs.readdirSync(sourceDir, { withFileTypes: true });
  
  files.forEach(file => {
    const sourcePath = path.join(sourceDir, file.name);
    const targetPath = path.join(targetDir, file.name);
    
    if (file.isDirectory()) {
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
      copyFiles(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`Copied: ${sourcePath} -> ${targetPath}`);
    }
  });
};

// Copy all utility files
copyFiles('utils', 'app/utils');

// Update imports in API routes
const updateApiImports = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      updateApiImports(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.ts') && fullPath.includes('/api/')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Replace relative paths with paths relative to app directory
      const updatedContent = content
        .replace(/\.\.\/\.\.\/\.\.\/(utils\/.*)/g, '../$1') // Replace ../../../utils/ with ../utils/
        .replace(/\.\.\/\.\.\/\.\.\/(utils\/search\/.*)/g, '../$1') // Replace ../../../utils/search/ with ../utils/search/
        .replace(/\.\.\/\.\.\/\.\.\/(utils\/supabase\/.*)/g, '../$1'); // Replace ../../../utils/supabase/ with ../utils/supabase/
      
      if (content !== updatedContent) {
        fs.writeFileSync(fullPath, updatedContent);
        console.log(`Updated imports in ${fullPath}`);
      }
    }
  }
};

// Update API route imports
console.log('Updating imports in API routes...');
updateApiImports('app/api');

console.log('Done! Utility files are now directly in the app directory structure.'); 