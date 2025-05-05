# Internal API Key Implementation Guide

This document explains how to set up and use the internal API key for securing sensitive endpoints in the LocalGuru application.

## 1. Generate a Secure API Key

Use the provided script to generate a secure API key:

```bash
node scripts/generate-api-key.js
```

This script generates a random 256-bit (32 byte) hexadecimal key that is cryptographically secure.

## 2. Add the Key to Environment Variables

Add the generated key to your `.env.local` file:

```
INTERNAL_API_KEY=your-generated-key-here
```

For production environments, add this key to your deployment environment variables.

## 3. Protected Endpoints

The following endpoints are protected with API key validation:

- `/api/embeddings` - Generating vector embeddings
- `/api/debug` - Debug and diagnostic information

## 4. Making Authenticated Requests

When calling protected endpoints, include the API key in the request headers:

```javascript
// Example of calling a protected endpoint
const response = await fetch('/api/embeddings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.INTERNAL_API_KEY
  },
  body: JSON.stringify({ query: 'Your query text' })
});
```

## 5. Adding Protection to New Endpoints

To protect additional endpoints with API key validation:

```javascript
import { withApiKeyValidation } from '@/app/lib/utils/api-key-middleware';

// Your handler function
async function handler(request) {
  // Your endpoint logic here
}

// Export the protected handler
export const POST = withApiKeyValidation(handler);
```

## Security Considerations

1. **Never expose the API key in client-side code** - It should only be used for server-to-server communication.
2. **Rotate keys periodically** - Generate new keys every few months or when team members change.
3. **Different keys for environments** - Use different keys for development, staging, and production.
4. **Monitor for unauthorized access** - Log and alert on 401 responses from protected endpoints.

## Validation Implementation

The system uses a constant-time comparison function to validate API keys, which protects against timing attacks that could be used to guess the key character by character. 