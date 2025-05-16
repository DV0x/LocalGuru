# Perplexity API Integration for LocalGuru

This guide explains how to set up and use the Perplexity API integration in the LocalGuru PWA.

## Overview

The Perplexity API integration enhances LocalGuru's search capabilities by:

1. Using Perplexity's online knowledge to provide up-to-date local recommendations
2. Leveraging location-aware prompting to generate contextual responses
3. Automatically extracting and geocoding mentioned locations
4. Rendering extracted locations on the interactive map

## Setup

### 1. Get a Perplexity API Key

1. Go to [Perplexity AI](https://www.perplexity.ai/api)
2. Create an account and subscribe to get API access
3. Generate an API key from your dashboard

### 2. Add Environment Variables

Create or modify `.env.local` in the root of `packages/pwa-app/` and add:

```
NEXT_PUBLIC_PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

### 3. Test the Integration

1. Start the development server
2. Navigate to `/perplexity-demo` to use the demo page
3. Try searches like "Best coffee shops in the Mission" or "Hidden gems for dinner"

## Implementation Details

### Key Components

- **PerplexitySearchClient**: Manages API requests to Perplexity with streaming support
- **usePerplexitySearch**: React hook for managing search state and location extraction
- **perplexity-location-parser**: Utilities for extracting and geocoding locations from responses

### How It Works

1. User enters a search query
2. Search request goes to Perplexity API with location-aware system prompt
3. Streaming response is transformed to match our app's expected format
4. Content is parsed for location data using [LOCATION: Name, Address, Description] syntax
5. Extracted locations are geocoded and displayed on the map

### Location Extraction

Locations are extracted from the Perplexity response using a special syntax:
```
[LOCATION: Business Name, Address, Description]
```

The system prompt instructs Perplexity to format location mentions using this pattern, which is then parsed and geocoded.

## Usage in Production

To use this integration in production:

1. Replace the existing `StreamingSearchClient` with `PerplexitySearchClient`
2. Replace `useStreamingSearch` hook with `usePerplexitySearch`
3. Add appropriate error handling for API key validation

## Limitations

- Requires a valid Perplexity API key
- Rate limits may apply based on your Perplexity subscription
- Location extraction depends on consistent formatting in responses 