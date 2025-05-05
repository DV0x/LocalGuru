#!/usr/bin/env node

/**
 * This script inlines essential utility functions directly into the API route files
 * to bypass module resolution issues in Vercel
 */

const fs = require('fs');
const path = require('path');

// Read utility files content
console.log('Reading utility file contents...');

// API Response utils
const apiResponsePath = 'app/utils/api-response.ts';
const apiResponseContent = fs.existsSync(apiResponsePath) 
  ? fs.readFileSync(apiResponsePath, 'utf8')
  : `
// Inlined API Response utilities
export function successResponse(data: any, status = 200) {
  return Response.json(
    { success: true, data },
    { status }
  );
}

export function errorResponse(message: string, status = 500) {
  return Response.json(
    { success: false, error: message },
    { status }
  );
}

export function timeoutResponse(partialData: any) {
  return Response.json(
    { 
      success: true, 
      data: partialData,
      timeout: true,
      message: 'Search timed out. Showing partial results.'
    },
    { status: 200 }
  );
}`;

// Error handling utils
const errorHandlingPath = 'app/utils/error-handling.ts';
const errorHandlingContent = fs.existsSync(errorHandlingPath)
  ? fs.readFileSync(errorHandlingPath, 'utf8')
  : `
// Inlined Error Handling utilities
export function handleApiError(error: unknown) {
  if (error instanceof Error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
  
  return Response.json(
    { success: false, error: 'An unknown error occurred' },
    { status: 500 }
  );
}

export function logApiError(context: string, error: unknown) {
  console.error(\`API Error in \${context}:\`, error);
}`;

// API Key Middleware
const apiKeyMiddlewarePath = 'app/utils/api-key-middleware.ts';
const apiKeyMiddlewareContent = fs.existsSync(apiKeyMiddlewarePath)
  ? fs.readFileSync(apiKeyMiddlewarePath, 'utf8')
  : `
// Inlined API Key Middleware
import { NextRequest } from 'next/server';

export function withApiKeyValidation(handler: (request: NextRequest) => Promise<Response>) {
  return async function(request: NextRequest) {
    const apiKey = request.headers.get('x-api-key');
    
    // Skip validation in development
    if (process.env.NODE_ENV === 'development') {
      return handler(request);
    }
    
    // In production, validate the API key
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return handler(request);
  };
}`;

// CSRF Utils
const csrfPath = 'app/utils/csrf.ts';
const csrfContent = fs.existsSync(csrfPath)
  ? fs.readFileSync(csrfPath, 'utf8')
  : `
// Inlined CSRF utilities
import { randomBytes } from 'crypto';

export async function generateCsrfToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    randomBytes(32, (err, buffer) => {
      if (err) reject(err);
      resolve(buffer.toString('hex'));
    });
  });
}`;

// Update API routes to inline utility functions
const updateApiRoutes = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      updateApiRoutes(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.ts') && fullPath.includes('/api/')) {
      console.log(`Processing ${fullPath}...`);
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      // Extract the route name (like csrf-token, debug, etc.)
      const routeName = path.basename(path.dirname(fullPath));
      
      if (routeName === 'csrf-token' && content.includes('../utils/csrf')) {
        // Create a modified version of csrfContent without imports
        // and inline it at the top of the file
        const inlinedCsrf = csrfContent.replace(/import.*?;/g, '');
        content = inlinedCsrf + '\n\n' + content.replace(/import.*?'\.\.\/utils\/csrf';/g, '');
        modified = true;
        console.log('- Inlined CSRF utilities');
      }
      
      if (content.includes('../utils/api-response')) {
        // Create a modified version of apiResponseContent without imports
        // and inline it at the top of the file
        const inlinedApiResponse = apiResponseContent.replace(/import.*?;/g, '');
        content = inlinedApiResponse + '\n\n' + content.replace(/import.*?'\.\.\/utils\/api-response';/g, '');
        modified = true;
        console.log('- Inlined API Response utilities');
      }
      
      if (content.includes('../utils/error-handling')) {
        // Create a modified version of errorHandlingContent without imports
        // and inline it at the top of the file
        const inlinedErrorHandling = errorHandlingContent.replace(/import.*?;/g, '');
        content = inlinedErrorHandling + '\n\n' + content.replace(/import.*?'\.\.\/utils\/error-handling';/g, '');
        modified = true;
        console.log('- Inlined Error Handling utilities');
      }
      
      if (content.includes('../utils/api-key-middleware')) {
        // Create a modified version of apiKeyMiddlewareContent without imports
        // and inline it at the top of the file
        const inlinedMiddleware = apiKeyMiddlewareContent.replace(/import.*?;/g, '');
        // Keep the NextRequest import
        content = inlinedMiddleware + '\n\n' + content.replace(/import.*?'\.\.\/utils\/api-key-middleware';/g, '');
        modified = true;
        console.log('- Inlined API Key Middleware');
      }
      
      if (modified) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
};

// Start processing API routes
console.log('Inlining utility functions in API routes...');
updateApiRoutes('app/api');

console.log('Done! Essential utilities are now inlined in the API routes.'); 