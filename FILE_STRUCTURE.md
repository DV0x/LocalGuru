# Social Connection Intent Enhancement - File Structure

## Overview

This document provides an organized view of all files created or modified as part of the social connection intent enhancement.

## File Structure

```
localguru/
├── supabase/
│   ├── functions/
│   │   ├── _shared/
│   │   │   └── cors.ts                       # Shared CORS configuration
│   │   └── query-analysis/
│   │       ├── index.ts                      # Main Edge Function (modified)
│   │       └── enhanced-intent-detection.ts  # Social connection enhancement module
│   └── migrations/
│       └── 20250313000000_enhanced_intent_search.sql  # Original intent enhancement SQL
│
├── sql/
│   ├── enhance_social_connection_intent.sql  # SQL functions for social connection detection
│   └── ...
│
├── scripts/
│   ├── apply_social_connection_enhancement.sh # Script to test the SQL enhancement
│   ├── test_enhanced_edge_function.js        # Local test simulation for the TypeScript module
│   ├── test_meetup_query.sh                  # Testing the original query with different intents
│   └── ...
│   
├── docs/
│   ├── SOCIAL_CONNECTION_ENHANCEMENT_GUIDE.md  # Comprehensive deployment guide
│   └── SOCIAL_CONNECTION_ENHANCEMENT_SUMMARY.md # Summary of the enhancement
│
└── FILE_STRUCTURE.md                          # This file
```

## Key Components

### 1. Edge Function Components

- **enhanced-intent-detection.ts**: TypeScript module with pattern detection and intent enhancement
- **index.ts** (modified): Added import and call to the enhancement function

### 2. Database Components

- **enhance_social_connection_intent.sql**: SQL functions for database-level enhancement:
  - `is_social_connection_query`: Detects social connection patterns
  - `social_connection_intent_trigger`: Trigger function for DB-level intent modification
  - `test_social_connection_enhancement`: Test function for simulation

### 3. Test Scripts

- **apply_social_connection_enhancement.sh**: Tests SQL functions and live API
- **test_enhanced_edge_function.js**: Local simulation of the enhancement logic
- **test_meetup_query.sh**: Tests query with different intent types to compare results

### 4. Documentation

- **SOCIAL_CONNECTION_ENHANCEMENT_GUIDE.md**: Comprehensive deployment guide
- **SOCIAL_CONNECTION_ENHANCEMENT_SUMMARY.md**: Summary of what was accomplished

## Modifications

The only existing file modified was:
- `supabase/functions/query-analysis/index.ts` - Added import and logic to use the enhancement

## Social Connection Patterns

The enhancement detects the following patterns:
- "meet people", "meeting people"
- "connect with people", "connecting with people"
- "find people", "finding people"
- "make friends", "making friends"
- "meetup with", "meet up with"
- "socialize with", "socializing with"
- "network with", "networking with"
- "get to know", "getting to know" 