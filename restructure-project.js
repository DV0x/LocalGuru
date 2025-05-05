#!/usr/bin/env node

/**
 * This script restructures the project according to Next.js conventions:
 * 1. Moves utility files from app/lib/utils to a top-level utils directory
 * 2. Updates imports in API routes to use the new path
 */

const fs = require('fs');
const path = require('path');

// Create utils directory if it doesn't exist
if (!fs.existsSync('utils')) {
  fs.mkdirSync('utils', { recursive: true });
}

// Move utility files from app/lib/utils to utils/
const utilsFiles = [
  'api-response.ts',
  'error-handling.ts',
  'api-key-middleware.ts',
  'csrf.ts',
  'csrf-middleware.ts',
  'api-key-validator.ts'
];

// Copy common service files from app/lib/supabase to utils/
const supabaseFiles = [
  'client-server.ts'
];

// Copy search utilities from app/lib/search to utils/
const searchFiles = [
  'query-processor.ts',
  'result-formatter.ts',
  'stream-processor.ts',
  'streaming-types.ts',
  'types.ts'
];

// Create search subdirectory
if (!fs.existsSync('utils/search')) {
  fs.mkdirSync('utils/search', { recursive: true });
}

// Create supabase subdirectory
if (!fs.existsSync('utils/supabase')) {
  fs.mkdirSync('utils/supabase', { recursive: true });
}

// Copy utility files
utilsFiles.forEach(file => {
  const sourcePath = path.join('app/lib/utils', file);
  const targetPath = path.join('utils', file);
  
  if (fs.existsSync(sourcePath)) {
    const content = fs.readFileSync(sourcePath, 'utf8');
    // Update any internal references from @/app/lib to @/utils
    const updatedContent = content.replace(/@\/app\/lib\//g, '@/utils/');
    fs.writeFileSync(targetPath, updatedContent);
    console.log(`Copied and updated: ${sourcePath} -> ${targetPath}`);
  } else {
    console.log(`Warning: Source file ${sourcePath} does not exist`);
  }
});

// Copy supabase files
supabaseFiles.forEach(file => {
  const sourcePath = path.join('app/lib/supabase', file);
  const targetPath = path.join('utils/supabase', file);
  
  if (fs.existsSync(sourcePath)) {
    const content = fs.readFileSync(sourcePath, 'utf8');
    // Update any internal references from @/app/lib to @/utils
    const updatedContent = content.replace(/@\/app\/lib\//g, '@/utils/');
    fs.writeFileSync(targetPath, updatedContent);
    console.log(`Copied and updated: ${sourcePath} -> ${targetPath}`);
  } else {
    console.log(`Warning: Source file ${sourcePath} does not exist`);
  }
});

// Copy search files
searchFiles.forEach(file => {
  const sourcePath = path.join('app/lib/search', file);
  const targetPath = path.join('utils/search', file);
  
  if (fs.existsSync(sourcePath)) {
    const content = fs.readFileSync(sourcePath, 'utf8');
    // Update any internal references from @/app/lib to @/utils
    const updatedContent = content.replace(/@\/app\/lib\//g, '@/utils/');
    fs.writeFileSync(targetPath, updatedContent);
    console.log(`Copied and updated: ${sourcePath} -> ${targetPath}`);
  } else {
    console.log(`Warning: Source file ${sourcePath} does not exist`);
  }
});

// Update imports in API routes
const updateImportsInDirectory = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      updateImportsInDirectory(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Replace @/app/lib/utils with @/utils
      // Replace @/app/lib/supabase with @/utils/supabase
      // Replace @/app/lib/search with @/utils/search
      const updatedContent = content
        .replace(/@\/app\/lib\/utils\//g, '@/utils/')
        .replace(/@\/app\/lib\/supabase\//g, '@/utils/supabase/')
        .replace(/@\/app\/lib\/search\//g, '@/utils/search/');
      
      if (content !== updatedContent) {
        fs.writeFileSync(fullPath, updatedContent);
        console.log(`Updated imports in ${fullPath}`);
      }
    }
  }
};

// Update tsconfig.json to include the new path mapping
const updateTsConfig = () => {
  const tsConfigPath = 'tsconfig.json';
  
  if (fs.existsSync(tsConfigPath)) {
    const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
    
    if (!tsConfig.compilerOptions.paths) {
      tsConfig.compilerOptions.paths = {};
    }
    
    // Add or update the utils path mapping
    tsConfig.compilerOptions.paths['@/utils/*'] = ['./utils/*'];
    
    fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
    console.log('Updated tsconfig.json with new path mappings');
  } else {
    console.log('Warning: tsconfig.json not found');
  }
};

// Start the update process
console.log('Updating imports in app directory...');
updateImportsInDirectory('app');

// Update tsconfig.json
updateTsConfig();

console.log('Project restructuring completed!'); 