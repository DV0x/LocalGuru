import axios from 'axios';

// Reddit API requires OAuth2 authentication
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || '';
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || '';
const REDDIT_USERNAME = process.env.REDDIT_USERNAME || '';
const REDDIT_PASSWORD = process.env.REDDIT_PASSWORD || '';
const REDDIT_USER_AGENT = 'web:localguru:v1.0.0 (by /u/' + REDDIT_USERNAME + ')';

// Function to get access token
export async function getRedditAccessToken() {
  try {
    const response = await axios({
      method: 'post',
      url: 'https://www.reddit.com/api/v1/access_token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64')}`,
        'User-Agent': REDDIT_USER_AGENT
      },
      data: `grant_type=password&username=${REDDIT_USERNAME}&password=${REDDIT_PASSWORD}`
    });
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Reddit access token:', error);
    throw error;
  }
}

// Function to fetch posts from a subreddit
export async function getSubredditPosts(subreddit: string, limit: number = 10, sort: string = 'hot') {
  try {
    const accessToken = await getRedditAccessToken();
    
    const response = await axios({
      method: 'get',
      url: `https://oauth.reddit.com/r/${subreddit}/${sort}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': REDDIT_USER_AGENT
      },
      params: {
        limit
      }
    });
    
    return response.data.data.children;
  } catch (error) {
    console.error(`Error fetching posts from r/${subreddit}:`, error);
    throw error;
  }
}

// Function to fetch comments for a specific post
export async function getPostComments(subreddit: string, postId: string, limit: number = 10) {
  try {
    const accessToken = await getRedditAccessToken();
    
    const response = await axios({
      method: 'get',
      url: `https://oauth.reddit.com/r/${subreddit}/comments/${postId}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': REDDIT_USER_AGENT
      },
      params: {
        limit,
        depth: 1
      }
    });
    
    // Reddit returns an array with two elements:
    // [0] = post details
    // [1] = comments
    return response.data[1].data.children;
  } catch (error) {
    console.error(`Error fetching comments for post ${postId}:`, error);
    throw error;
  }
}

// Main function to fetch data from multiple travel subreddits and analyze response structure
export async function fetchRedditTravelData() {
  const travelSubreddits = ['travel', 'TravelHacks', 'AskReddit', 'solotravel', 'backpacking'];
  const results: any = {};
  
  try {
    // Fetch top posts from each subreddit
    for (const subreddit of travelSubreddits) {
      console.log(`Fetching posts from r/${subreddit}...`);
      const posts = await getSubredditPosts(subreddit, 5);
      
      if (posts && posts.length > 0) {
        // Get comments for the first post
        const firstPostId = posts[0].data.id;
        console.log(`Fetching comments for post ${firstPostId}...`);
        const comments = await getPostComments(subreddit, firstPostId);
        
        results[subreddit] = {
          posts: posts.slice(0, 2), // limiting for readability
          sampleComments: comments.slice(0, 2) // limiting for readability
        };
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error fetching Reddit travel data:', error);
    throw error;
  }
} 