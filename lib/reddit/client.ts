// Reddit API client for fetching travel-related data
// Note: Reddit API requires authentication for most endpoints

// Environment variables should be defined in .env.local
const clientId = process.env.REDDIT_CLIENT_ID;
const clientSecret = process.env.REDDIT_CLIENT_SECRET;
const username = process.env.REDDIT_USERNAME;
const password = process.env.REDDIT_PASSWORD;

// Base URL for Reddit API
const REDDIT_API_BASE_URL = 'https://oauth.reddit.com';
const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';

// Cache for the access token
let accessToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Authenticate with Reddit API and get an access token
 */
async function getAccessToken(): Promise<string> {
  // Check if we have a valid token
  if (accessToken && tokenExpiry > Date.now()) {
    return accessToken;
  }

  // Ensure environment variables are defined
  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('Missing Reddit API credentials');
  }

  try {
    const response = await fetch(REDDIT_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'User-Agent': 'LocalGuru/1.0.0',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username,
        password,
      }),
    });

    if (!response.ok) {
      throw new Error(`Reddit authentication failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    accessToken = data.access_token as string;
    // Set expiry time (subtract 60 seconds for safety)
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

    return accessToken;
  } catch (error) {
    console.error('Error authenticating with Reddit:', error);
    throw new Error('Failed to authenticate with Reddit API');
  }
}

/**
 * Fetch posts from a subreddit
 */
export async function fetchSubredditPosts(subreddit: string, limit: number = 25): Promise<any[]> {
  try {
    const token = await getAccessToken();
    const response = await fetch(`${REDDIT_API_BASE_URL}/r/${subreddit}/hot?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'LocalGuru/1.0.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from subreddit: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.children.map((child: any) => child.data);
  } catch (error) {
    console.error(`Error fetching posts from r/${subreddit}:`, error);
    throw new Error(`Failed to fetch posts from r/${subreddit}`);
  }
}

/**
 * Search Reddit for travel-related content
 */
export async function searchReddit(query: string, limit: number = 25): Promise<any[]> {
  try {
    const token = await getAccessToken();
    // Add travel-related terms to the query
    const travelQuery = `${query} (travel OR vacation OR destination OR tourism)`;
    
    const response = await fetch(
      `${REDDIT_API_BASE_URL}/search?q=${encodeURIComponent(travelQuery)}&limit=${limit}&sort=relevance&t=year`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'LocalGuru/1.0.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Reddit search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.children.map((child: any) => child.data);
  } catch (error) {
    console.error(`Error searching Reddit for "${query}":`, error);
    throw new Error('Failed to search Reddit');
  }
} 