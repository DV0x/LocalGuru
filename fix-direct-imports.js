#!/usr/bin/env node

/**
 * This script updates all API routes to use direct relative imports
 * This completely avoids using path aliases (@/utils) which can be problematic in Vercel
 */

const fs = require('fs');
const path = require('path');

// Update imports in API routes to use relative paths
const updateApiRoutes = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      updateApiRoutes(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.ts') && fullPath.includes('/api/')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Calculate relative path to utils from this file
      const fileDir = path.dirname(fullPath);
      const relativeToRoot = path.relative(fileDir, process.cwd());
      
      // Replace @/utils with relative path
      const updatedContent = content
        .replace(/@\/utils\//g, `${relativeToRoot}/utils/`)
        .replace(/@\/utils\/search\//g, `${relativeToRoot}/utils/search/`)
        .replace(/@\/utils\/supabase\//g, `${relativeToRoot}/utils/supabase/`);
      
      if (content !== updatedContent) {
        fs.writeFileSync(fullPath, updatedContent);
        console.log(`Updated imports in ${fullPath}`);
      }
    }
  }
};

// Start from the app directory
console.log('Updating imports in API routes to use direct relative paths...');
updateApiRoutes('app');

console.log('Direct path import update completed!'); 