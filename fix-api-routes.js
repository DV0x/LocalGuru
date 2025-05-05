#!/usr/bin/env node

/**
 * This script updates all API routes to use direct relative imports instead of path aliases
 */

const fs = require('fs');
const path = require('path');

// Update imports in API route files to use relative paths
const updateApiRoutes = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      updateApiRoutes(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Calculate relative path depth (how many levels deep from api/ directory)
      const pathFromApi = path.relative('app/api', dir);
      const upLevels = pathFromApi.split(path.sep).length;
      const prefix = '../'.repeat(upLevels + 1); // +1 to get to app's parent
      
      // Replace @/lib with relative path
      const updatedContent = content.replace(/@\/lib\//g, `${prefix}lib/`);
      
      if (content !== updatedContent) {
        fs.writeFileSync(fullPath, updatedContent);
        console.log(`Updated imports in ${fullPath}`);
      }
    }
  }
};

// Start from the api directory
console.log('Updating imports in API routes to use relative paths...');
updateApiRoutes('app/api');

console.log('Completed API route updates.'); 