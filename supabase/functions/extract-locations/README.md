# Location Extraction Edge Function

This Supabase Edge Function extracts business names and locations from search result snippets, geocodes them using Mapbox, and stores them in the database.

## Functionality

1. Takes an array of search results with text snippets
2. Extracts business/location names using OpenAI
3. Geocodes the locations using Mapbox
4. Stores the results in a `locations` table
5. Returns the extracted location data

## Required Environment Variables

- `OPENAI_API_KEY` - For extracting location names from text
- `MAPBOX_API_KEY` - For geocoding (converting location names to coordinates)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - For database access

## Deployment

```bash
# Navigate to the supabase directory (from project root)
cd supabase

# Deploy the function
supabase functions deploy extract-locations

# Set environment variables
supabase secrets set OPENAI_API_KEY=your_openai_key
supabase secrets set MAPBOX_API_KEY=your_mapbox_key
```

## Usage

```typescript
// Example usage from client
const { data, error } = await supabase.functions.invoke('extract-locations', {
  body: {
    searchResults: [
      {
        id: '1',
        title: 'Coffee shops in Mission',
        snippet: 'Blue Bottle Coffee offers great pour-over options. Nearby, Tartine Bakery is known for their pastries.'
      }
    ]
  }
});

// Response structure
// {
//   locations: [
//     {
//       id: 'uuid',
//       name: 'Blue Bottle Coffee',
//       longitude: -122.4194,
//       latitude: 37.7749,
//       address: '123 Main St, San Francisco, CA',
//       confidence: 0.9,
//       source_text: '...',
//       created_at: '2023-06-15T...'
//     },
//     ...
//   ]
// }
```

## Database Schema

This function requires a table with the following structure:

```sql
create table public.locations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  source_text text not null,
  longitude float not null,
  latitude float not null,
  address text,
  confidence float default 0.8,
  created_at timestamptz default now(),
  unique(name)
);

-- Indexes for performance
create index idx_locations_name on public.locations(name);
create index idx_locations_source_text on public.locations(source_text);
``` 