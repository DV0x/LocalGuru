# LocalGuru Farcaster Integration - Hackathon Submission

## Project: Social Location Discovery

This hackathon project enhances the LocalGuru platform by integrating Farcaster social data to provide users with authentic, community-driven location recommendations alongside traditional structured search results.

## Problem Statement

Traditional location search platforms rely on structured data that may be outdated or miss the authentic voice of real users. Social media contains a wealth of genuine recommendations and experiences that can significantly enhance location discovery.

## Solution

We've built a dual-search system that:

1. **Combines structured and social data** - Get official listings and social recommendations in one interface
2. **Extracts location data from social posts** - Uses NLP to identify locations in Farcaster posts
3. **Presents a unified UI** - Toggle between official and social tabs with a consistent interface
4. **Visualizes results on interactive maps** - See all recommendations spatially organized

## Technical Implementation

### Farcaster Integration (Neynar API)

The core of our implementation is the `FarcasterClient` class that handles interaction with the Neynar API:

- **Multi-strategy search** - Uses multiple fallback strategies to ensure results
- **Trending detection** - Identifies trending locations from Farcaster feeds
- **Power user content** - Prioritizes content from verified/power users
- **Robust error handling** - Includes fallback mechanisms to handle API limitations

### Location Extraction

We've built a specialized system to extract meaningful location data from social posts:

- **Named entity recognition** - Identifies location names in post text
- **Geocoding integration** - Converts text locations to coordinates
- **Confidence scoring** - Ranks extracted locations by reliability
- **Metadata preservation** - Maintains attribution to original posts

### UI Components

Custom React components for the social integration:

- **FarcasterLocationCard** - Displays social recommendations with attribution
- **ResultsToggle** - Allows users to switch between official and social results
- **DraggableContentOverlay** - Responsive container for search results

## Key Features

1. **Authentic Recommendations** - Surface genuine community favorites not found in official listings
2. **Real-Time Social Signals** - Show trending locations based on current social activity
3. **Enhanced Search UX** - Uniform interface for different data sources
4. **Robust Implementation** - Multiple fallback strategies ensure reliable results

## Technical Challenges Overcome

1. **API Limitations** - Built a robust multi-strategy approach to handle Neynar API constraints
2. **Location Extraction** - Developed fallback mechanisms for when API-based extraction fails
3. **Data Consistency** - Created uniform data structures across different sources
4. **Search Reliability** - Implemented client-side filtering for more flexible matching

## Demo Instructions

1. Browse to the structured demo page
2. Enter a search term (e.g., "coffee shops")
3. Specify a location (e.g., "New York")
4. Toggle between "Official" and "Social" tabs to compare results
5. Click on map markers to explore location details

## Future Enhancements

1. **Improved Location Extraction** - Further refinement of NLP for location detection
2. **User Authentication** - Allow users to connect their Farcaster accounts
3. **Personalized Results** - Prioritize results based on user's Farcaster graph
4. **Cast Creation** - Enable creating new Farcaster posts about locations

## Team

- Team LocalGuru

## Technologies Used

- Next.js 14
- TypeScript
- Neynar API (Farcaster)
- Mapbox
- TailwindCSS
- Supabase 