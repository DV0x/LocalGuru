import { LocationData } from './location-client';

export interface FarcasterCast {
  hash: string;
  author: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
    profile?: {
      location?: {
        latitude: number;
        longitude: number;
        address: {
          city: string;
          state?: string;
          state_code?: string;
          country?: string;
          country_code?: string;
        }
      }
    };
    power_badge?: boolean;
  };
  text: string;
  timestamp: string;
  reactions: {
    likes_count: number;
    recasts_count: number;
  };
  isPowerUser?: boolean;
  isTrending?: boolean;
  engagement?: number;
}

export class FarcasterClient {
  private apiKey: string;
  private baseUrl = 'https://api.neynar.com/v2';

  constructor(apiKey?: string) {
    // Get the API key from props or environment variables
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_NEYNAR_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('No Neynar API key provided. Service will not work.');
    }
  }

  /**
   * Search for casts related to a query at a specific location
   */
  async searchCastsForQuery(query: string, location: string, options: any = {}): Promise<{casts: FarcasterCast[]}> {
    try {
      console.log(`Searching Farcaster for "${query}" in ${location}`);
      
      // Set up request options
      const limit = Math.min(options.limit || 10, 10); // Ensure limit is between 1-10
      
      // Use correct header format for Neynar API v2
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      };

      // Try multiple search strategies if needed
      let allCasts: any[] = [];
      
      // Strategy 1: Try with just the query (most results)
      try {
        const searchQuery = query.replace(/[^\w\s]/gi, '').trim(); // Remove special characters
        
        console.log(`Strategy 1: Searching with query "${searchQuery}"`);
        const response = await fetch(`${this.baseUrl}/farcaster/cast/search?q=${encodeURIComponent(searchQuery)}&limit=${limit}&mode=hybrid`, {
          method: 'GET',
          headers
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Strategy 1 results: ${data.result?.casts?.length || 0} casts`);
          if (data.result?.casts?.length > 0) {
            allCasts = [...data.result.casts];
          }
        } else {
          console.log(`Strategy 1 failed with status ${response.status}`);
        }
      } catch (error) {
        console.error('Strategy 1 error:', error);
      }
      
      // Strategy 2: If we got no results, try with location only
      if (allCasts.length === 0 && location) {
        try {
          const cleanLocation = location.replace(/[^\w\s]/gi, '').trim(); // Remove special characters
          
          console.log(`Strategy 2: Searching with location "${cleanLocation}"`);
          const response = await fetch(`${this.baseUrl}/farcaster/cast/search?q=${encodeURIComponent(cleanLocation)}&limit=${limit}&mode=hybrid`, {
            method: 'GET',
            headers
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log(`Strategy 2 results: ${data.result?.casts?.length || 0} casts`);
            if (data.result?.casts?.length > 0) {
              allCasts = [...data.result.casts];
            }
          } else {
            console.log(`Strategy 2 failed with status ${response.status}`);
          }
        } catch (error) {
          console.error('Strategy 2 error:', error);
        }
      }
      
      // Strategy 3: If we still have no results, try the global feed as fallback
      if (allCasts.length === 0) {
        try {
          console.log(`Strategy 3: Fetching global feed as fallback`);
          const response = await fetch(`${this.baseUrl}/farcaster/feed/channels?limit=${limit}`, {
            method: 'GET',
            headers
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log(`Strategy 3 results: ${data.casts?.length || 0} casts from global feed`);
            if (data.casts?.length > 0) {
              allCasts = [...data.casts];
            }
          } else {
            console.log(`Strategy 3 failed with status ${response.status}`);
          }
        } catch (error) {
          console.error('Strategy 3 error:', error);
        }
      }
      
      // Filter results to include the location/query if we have any
      let filteredCasts = allCasts;
      
      // Only apply filtering if we actually have results
      if (filteredCasts.length > 0 && (query || location)) {
        const queryTerms = query.toLowerCase().split(' ');
        const locationLower = location.toLowerCase();
        
        // Try to find posts that include either the query terms or location
        filteredCasts = allCasts.filter((cast: any) => {
          const text = cast.text.toLowerCase();
          const matchesLocation = locationLower && text.includes(locationLower);
          const matchesQuery = queryTerms.some(term => text.includes(term));
          return matchesLocation || matchesQuery;
        });
        
        console.log(`Filtered to ${filteredCasts.length} casts related to query or location`);
        
        // If filtering left us with no results, use all casts
        if (filteredCasts.length === 0) {
          console.log('Filtering removed all results, using unfiltered results');
          filteredCasts = allCasts;
        }
      }
      
      // Process casts to add engagement metrics
      const processedCasts = this.processCasts(filteredCasts);
      
      return { casts: processedCasts };
    } catch (error) {
      console.error('Error searching Farcaster casts:', error);
      return { casts: [] };
    }
  }

  /**
   * Fetch trending casts for a specific location
   */
  async fetchTrendingLocationCasts(location: string, options: any = {}): Promise<{casts: FarcasterCast[]}> {
    try {
      console.log(`Fetching trending Farcaster casts for ${location}`);
      
      // Set up request options
      const limit = Math.min(options.limit || 10, 10); // Ensure limit is between 1-10
      
      // Use correct header format for Neynar API v2
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      };
      
      // Try to get trending casts
      let allCasts: any[] = [];
      
      // Strategy 1: Try trending endpoint
      try {
        console.log('Strategy 1: Using trending endpoint');
        const response = await fetch(`${this.baseUrl}/farcaster/feed/trending?limit=${limit}`, {
          method: 'GET',
          headers
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Strategy 1 results: ${data.casts?.length || 0} trending casts`);
          if (data.casts?.length > 0) {
            allCasts = [...data.casts];
          }
        } else {
          console.log(`Strategy 1 failed with status ${response.status}`);
        }
      } catch (error) {
        console.error('Strategy 1 error:', error);
      }
      
      // Strategy 2: If no results, try a broader channel feed
      if (allCasts.length === 0) {
        try {
          console.log('Strategy 2: Using channel feed');
          const response = await fetch(`${this.baseUrl}/farcaster/feed/channels?limit=${limit}`, {
            method: 'GET',
            headers
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log(`Strategy 2 results: ${data.casts?.length || 0} channel casts`);
            if (data.casts?.length > 0) {
              allCasts = [...data.casts];
            }
          } else {
            console.log(`Strategy 2 failed with status ${response.status}`);
          }
        } catch (error) {
          console.error('Strategy 2 error:', error);
        }
      }
      
      // Filter results by location if we have any casts
      let locationCasts = allCasts;
      
      if (locationCasts.length > 0 && location && location.trim() !== '') {
        const locationLower = location.toLowerCase();
        const locationTerms = locationLower.split(' ');
        
        // Try to match on any part of the location (e.g., "New York" -> "New" or "York")
        locationCasts = allCasts.filter((cast: any) => {
          const text = cast.text.toLowerCase();
          return locationTerms.some(term => text.includes(term));
        });
        
        console.log(`Filtered to ${locationCasts.length} trending casts related to "${location}"`);
        
        // If filtering removed all results, just return some trending casts
        if (locationCasts.length === 0) {
          console.log('Location filtering removed all results, using unfiltered trending casts');
          locationCasts = allCasts;
        }
      }
      
      // Process casts and mark them as trending
      const processedCasts = this.processCasts(locationCasts, true);
   
      return { casts: processedCasts };
    } catch (error) {
      console.error('Error fetching trending Farcaster casts:', error);
      return { casts: [] };
    }
  }

  /**
   * Fetch users with power badges
   */
  async fetchPowerUsers(options: any = {}): Promise<{users: any[]}> {
    try {
      console.log('Fetching Farcaster power users');
      
      // Set up request options
      const limit = Math.min(options.limit || 10, 10); // Ensure limit is between 1-10
      
      // Use correct header format for Neynar API v2
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      };
      
      // Correct endpoint for fetching users with power badges
      const response = await fetch(`${this.baseUrl}/farcaster/user/search?power_badge=true&limit=${limit}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Farcaster power users error:', response.status, errorText);
        throw new Error(`Farcaster power users failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Found ${data.users?.length || 0} Farcaster power users`);
   
      return { users: data.users || [] };
    } catch (error) {
      console.error('Error fetching Farcaster power users:', error);
      return { users: [] };
    }
  }

  /**
   * Fetch casts from power users
   */
  async fetchPowerUserCasts(query: string, location: string, options: any = {}): Promise<{casts: FarcasterCast[]}> {
    try {
      console.log(`Fetching power user casts for "${query}" in ${location}`);
      
      // First, get power users
      const { users } = await this.fetchPowerUsers({ limit: 10 }); // Limit to 10 users to respect API limits
      
      if (!users || users.length === 0) {
        return { casts: [] };
      }
      
      // Get FIDs from power users
      const fids = users.map((user: any) => user.fid);
      
      // Use just the query for search to get more results
      const searchQuery = query;
      
      // Set up request options
      const limit = Math.min(options.limit || 10, 10); // Ensure limit is between 1-10
      
      // Use correct header format for Neynar API v2
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      };
      
      // Use the correct endpoint with author_fid parameter
      const response = await fetch(`${this.baseUrl}/farcaster/cast/search?q=${encodeURIComponent(searchQuery)}&limit=${limit}&author_fid=${fids[0]}&mode=hybrid`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Farcaster power user casts error:', response.status, errorText);
        throw new Error(`Farcaster power user casts failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Found ${data.result?.casts?.length || 0} power user casts for query "${query}"`);
      
      // Get all casts
      let casts = data.result?.casts || [];
      
      // Filter results to include only those that mention the location
      if (location && location.trim() !== '') {
        const locationLower = location.toLowerCase();
        casts = casts.filter((cast: any) => 
          cast.text.toLowerCase().includes(locationLower)
        );
        console.log(`Filtered to ${casts.length} power user casts mentioning "${location}"`);
      }
      
      // Process casts and mark them as from power users
      const processedCasts = this.processCasts(casts).map(cast => ({
        ...cast,
        isPowerUser: true
      }));
   
      return { casts: processedCasts };
    } catch (error) {
      console.error('Error fetching power user casts:', error);
      return { casts: [] };
    }
  }

  /**
   * Combine search methods for comprehensive location search
   */
  async combinedLocationSearch(query: string, location: string, options: any = {}): Promise<{casts: FarcasterCast[]}> {
    try {
      console.log(`Combined location search for "${query}" in "${location}"`);
      
      // Try multiple search strategies in parallel for better performance
      const [regularSearch, trendingSearch] = await Promise.all([
        this.searchCastsForQuery(query, location, options).catch(error => {
          console.error('Regular search error in combined search:', error);
          return { casts: [] };
        }),
        this.fetchTrendingLocationCasts(location, options).catch(error => {
          console.error('Trending search error in combined search:', error);
          return { casts: [] };
        })
      ]);
      
      console.log(`Search results: ${regularSearch.casts.length} regular, ${trendingSearch.casts.length} trending`);
      
      // Combine and deduplicate results based on cast hash
      const allCasts = [
        ...trendingSearch.casts,
        ...regularSearch.casts
      ];
      
      // If we have no results at all, try a last-ditch approach with a very general search
      if (allCasts.length === 0) {
        console.log('No results from primary searches, trying fallback general search');
        
        try {
          // Just search for a very common term to get some results
          const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey
          };
          
          const fallbackQuery = location || 'restaurant'; // Use location or a generic term
          const limit = Math.min(options.limit || 10, 10);
          
          const response = await fetch(`${this.baseUrl}/farcaster/feed/channels?limit=${limit}`, {
            method: 'GET',
            headers
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.casts && data.casts.length > 0) {
              console.log(`Fallback general search returned ${data.casts.length} results`);
              
              // Process and add these casts
              const fallbackCasts = this.processCasts(data.casts);
              return { casts: fallbackCasts };
            }
          }
        } catch (error) {
          console.error('Fallback general search error:', error);
        }
      }
      
      // Use a Map to deduplicate by hash
      const uniqueCastsMap = new Map();
      
      allCasts.forEach(cast => {
        // If the cast doesn't exist yet or if the current one has better properties
        const existingCast = uniqueCastsMap.get(cast.hash);
        
        if (!existingCast || (cast.isTrending && !existingCast.isTrending)) {
          uniqueCastsMap.set(cast.hash, cast);
        }
      });
      
      // Convert back to array and sort by engagement score
      const combinedCasts = Array.from(uniqueCastsMap.values())
        .sort((a, b) => {
          // Trending first
          if (a.isTrending && !b.isTrending) return -1;
          if (!a.isTrending && b.isTrending) return 1;
          
          // Then by engagement
          return (b.engagement || 0) - (a.engagement || 0);
        });
      
      console.log(`Combined search returned ${combinedCasts.length} unique casts`);
      
      return { casts: combinedCasts };
    } catch (error) {
      console.error('Error in combined location search:', error);
      return { casts: [] };
    }
  }

  /**
   * Extract locations from cast content
   */
  async extractLocationsFromCasts(casts: FarcasterCast[]): Promise<LocationData[]> {
    try {
      if (!casts || casts.length === 0) {
        return [];
      }
      
      console.log(`Extracting locations from ${casts.length} Farcaster casts`);
      
      // Extract text from casts for location extraction
      const castsWithMetadata = casts.map(cast => ({
        text: cast.text,
        source: `farcaster:${cast.hash}`,
        metadata: {
          authorName: cast.author.display_name,
          authorUsername: cast.author.username,
          authorPfp: cast.author.pfp_url,
          authorFid: cast.author.fid,
          timestamp: cast.timestamp,
          isPowerUser: cast.isPowerUser || cast.author.power_badge,
          isTrending: cast.isTrending,
          engagement: cast.engagement,
        }
      }));
      
      try {
        // Try to call the extract-locations API
        const response = await fetch('/api/extract-location-names', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ texts: castsWithMetadata }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Location extraction error (${response.status}):`, errorText);
          throw new Error(`Failed to extract locations: ${response.status}`);
        }

        const { locations } = await response.json();
        
        console.log(`Extracted ${locations?.length || 0} locations from Farcaster casts`);
        
        return locations || [];
      } catch (error) {
        console.error('Error extracting locations from casts, using fallback method:', error);
        
        // Fallback: Extract any embedded location data from the cast authors
        const fallbackLocations: LocationData[] = [];
        
        for (let i = 0; i < casts.length; i++) {
          const cast = casts[i];
          
          // If the cast author has a location in their profile, use that
          if (cast.author.profile?.location) {
            const loc = cast.author.profile.location;
            
            if (loc.latitude && loc.longitude) {
              const locationName = loc.address?.city || 'Unknown location';
              
              fallbackLocations.push({
                id: `fallback-${cast.hash}-${i}`,
                name: locationName,
                latitude: loc.latitude,
                longitude: loc.longitude,
                address: [
                  loc.address?.city, 
                  loc.address?.state, 
                  loc.address?.country
                ].filter(Boolean).join(', '),
                confidence: 0.7,
                source_text: cast.text,
                created_at: new Date().toISOString(),
                metadata: {
                  authorName: cast.author.display_name,
                  authorUsername: cast.author.username,
                  authorPfp: cast.author.pfp_url,
                  authorFid: cast.author.fid,
                  timestamp: cast.timestamp,
                  isPowerUser: cast.isPowerUser || cast.author.power_badge,
                  isTrending: cast.isTrending,
                  engagement: cast.engagement,
                }
              });
            }
          } else {
            // Simple fallback - create a "location" based on the cast itself
            // Just to ensure something shows up in the UI
            fallbackLocations.push({
              id: `fallback-${cast.hash}-${i}`,
              name: `${cast.author.display_name}'s Post`,
              // Default to NYC coordinates if searching for New York, or SF coordinates otherwise
              latitude: cast.text.toLowerCase().includes('new york') ? 40.7128 : 37.7749,
              longitude: cast.text.toLowerCase().includes('new york') ? -74.0060 : -122.4194,
              address: "Location mentioned in post",
              confidence: 0.5,
              source_text: cast.text,
              created_at: new Date().toISOString(),
              metadata: {
                authorName: cast.author.display_name,
                authorUsername: cast.author.username,
                authorPfp: cast.author.pfp_url,
                authorFid: cast.author.fid,
                timestamp: cast.timestamp,
                isPowerUser: cast.isPowerUser || cast.author.power_badge,
                isTrending: cast.isTrending,
                engagement: cast.engagement,
              }
            });
          }
        }
        
        console.log(`Created ${fallbackLocations.length} fallback locations from Farcaster casts`);
        return fallbackLocations;
      }
    } catch (error) {
      console.error('Error extracting locations from casts:', error);
      return [];
    }
  }

  /**
   * Process casts to add engagement scores and other metadata
   */
  private processCasts(casts: any[], isTrending: boolean = false): FarcasterCast[] {
    return casts.map(cast => {
      // Calculate engagement score
      const likesCount = cast.reactions?.likes_count || 0;
      const recastsCount = cast.reactions?.recasts_count || 0;
      const engagement = likesCount + (recastsCount * 2); // Weight recasts more heavily
      
      return {
        ...cast,
        isTrending: isTrending,
        engagement
      };
    });
  }
} 