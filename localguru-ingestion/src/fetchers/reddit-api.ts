import axios from 'axios';
import { delay } from '../utils/helpers';
import { Logger } from '../utils/logger';

export interface RedditAPIConfig {
  userAgent: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  requestDelay?: number;
}

export class RedditAPI {
  private userAgent: string;
  private clientId?: string;
  private clientSecret?: string;
  private username?: string;
  private password?: string;
  private auth: any;
  private requestDelay: number;
  private lastRequestTime: number = 0;
  private logger: Logger;
  private maxRetries: number = 3;
  private initialRetryDelay: number = 1000;
  private maxRetryDelay: number = 30000;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private tokenRefreshInProgress: boolean = false;
  private consecutiveForbiddenErrors: number = 0;
  private lastTokenRefresh: number = 0;

  constructor(config: RedditAPIConfig) {
    this.userAgent = config.userAgent;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.username = config.username;
    this.password = config.password;
    this.requestDelay = config.requestDelay || 2000;
    this.logger = new Logger('RedditAPI');
    
    if (config.clientId && config.clientSecret) {
      this.auth = {
        username: config.clientId,
        password: config.clientSecret
      };
      
      // Immediately get a token if we have credentials
      if (config.username && config.password) {
        this.getAccessToken().catch(err => {
          this.logger.warn(`Initial token acquisition failed: ${err.message}`);
        });
      }
    }
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      await delay(this.requestDelay - timeSinceLastRequest);
    }
    
    this.lastRequestTime = Date.now();
  }

  private getRetryDelay(attempt: number): number {
    const exponentialDelay = this.initialRetryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, this.maxRetryDelay);
  }

  // New method to get an OAuth access token
  private async getAccessToken(): Promise<string> {
    // Prevent multiple concurrent token requests
    if (this.tokenRefreshInProgress) {
      this.logger.info('Token refresh already in progress, waiting...');
      // Wait for the current refresh to complete
      while (this.tokenRefreshInProgress) {
        await delay(100);
      }
      
      // If we now have a valid token, return it
      if (this.accessToken && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }
    }
    
    this.tokenRefreshInProgress = true;
    
    try {
      // Check if we have the required credentials
      if (!this.clientId || !this.clientSecret || !this.username || !this.password) {
        throw new Error('Missing credentials for OAuth authentication');
      }
      
      this.logger.info('Getting new Reddit access token...');
      
      // Enforce minimum time between token refreshes (5 seconds)
      const timeSinceLastRefresh = Date.now() - this.lastTokenRefresh;
      if (timeSinceLastRefresh < 5000) {
        await delay(5000 - timeSinceLastRefresh);
      }
      
      const response = await axios.post(
        'https://www.reddit.com/api/v1/access_token',
        `grant_type=password&username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent
          },
          auth: this.auth,
          timeout: 10000
        }
      );
      
      if (response.data && response.data.access_token) {
        this.accessToken = response.data.access_token;
        // Set expiry time (typically 1 hour for Reddit, but we use 50 minutes to be safe)
        this.tokenExpiry = Date.now() + (response.data.expires_in ? (response.data.expires_in * 1000) - 600000 : 3000000);
        this.lastTokenRefresh = Date.now();
        this.consecutiveForbiddenErrors = 0;
        this.logger.info('Successfully obtained Reddit access token');
        return this.accessToken as string;
      } else {
        throw new Error('Failed to get access token: Invalid response');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message;
      this.logger.error(`Error getting access token: ${errorMsg}`);
      throw new Error(`Reddit authentication failed: ${errorMsg}`);
    } finally {
      this.tokenRefreshInProgress = false;
    }
  }

  // Verify and refresh token if needed
  private async ensureValidToken(): Promise<string> {
    // If we don't have a token or it's expired, get a new one
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      return this.getAccessToken();
    }
    return this.accessToken;
  }

  // Modified API request method that uses OAuth
  async get(endpoint: string, params: any = {}): Promise<any> {
    await this.respectRateLimit();
    
    let lastError: any = null;
    let useOAuth = false;
    
    // Try to use OAuth if we have credentials
    if (this.clientId && this.clientSecret && this.username && this.password) {
      useOAuth = true;
    }
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        let response;
        
        if (useOAuth) {
          // Get a valid access token
          const token = await this.ensureValidToken();
          
          // Make request with OAuth token
          response = await axios.get(
            endpoint.startsWith('http') ? endpoint : `https://oauth.reddit.com${endpoint}`,
            {
              params: {
                ...params,
                raw_json: 1
              },
              headers: {
                'User-Agent': this.userAgent,
                'Authorization': `Bearer ${token}`
              },
              timeout: 15000
            }
          );
        } else {
          // Fallback to basic auth for public endpoints
          response = await axios.get(
            endpoint.startsWith('http') ? endpoint : `https://www.reddit.com${endpoint}`,
            {
              params: {
                ...params,
                raw_json: 1
              },
              headers: {
                'User-Agent': this.userAgent
              },
              auth: this.auth,
              timeout: 15000
            }
          );
        }
        
        // Reset forbidden error counter on success
        this.consecutiveForbiddenErrors = 0;
        return response.data;
        
      } catch (error: any) {
        lastError = error;
        
        this.logger.error(`Reddit API error (attempt ${attempt + 1}/${this.maxRetries + 1}): ${error.message}`);
        
        if (attempt === this.maxRetries) {
          throw new Error(`Reddit API error after ${this.maxRetries + 1} attempts: ${error.message}`);
        }
        
        // Special handling for 403 Forbidden errors
        const isForbiddenError = error.response && error.response.status === 403;
        if (isForbiddenError) {
          this.consecutiveForbiddenErrors++;
          
          // If using OAuth and getting forbidden errors, force token refresh
          if (useOAuth) {
            this.logger.warn(`403 Forbidden error detected (${this.consecutiveForbiddenErrors} consecutive). Forcing token refresh...`);
            this.accessToken = null; // Force token refresh
            
            // Add exponential backoff for consecutive 403s
            const forbiddenBackoff = Math.min(Math.pow(2, this.consecutiveForbiddenErrors) * 3000, 60000);
            this.logger.info(`Waiting ${Math.round(forbiddenBackoff / 1000)} seconds before retry due to 403 error...`);
            await delay(forbiddenBackoff);
            continue;
          }
        }
        
        const isNetworkError = error.code === 'ECONNRESET' 
          || error.code === 'ETIMEDOUT'
          || error.code === 'ECONNABORTED'
          || error.code === 'ENOTFOUND';
          
        const isServerError = error.response && error.response.status >= 500;
        const isRateLimitError = error.response && error.response.status === 429;
        
        if (isNetworkError || isServerError || isRateLimitError) {
          const retryDelay = this.getRetryDelay(attempt);
          this.logger.info(`Retrying in ${Math.round(retryDelay / 1000)} seconds...`);
          await delay(retryDelay);
          continue;
        }
        
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          // For client errors other than 403 (which we handle above)
          if (!isForbiddenError) {
            throw error;
          }
        }
        
        const retryDelay = this.getRetryDelay(attempt);
        this.logger.info(`Retrying in ${Math.round(retryDelay / 1000)} seconds...`);
        await delay(retryDelay);
      }
    }
    
    throw lastError || new Error('Unknown error in Reddit API');
  }

  async getSubredditPosts(subreddit: string, options: {
    limit?: number;
    after?: string;
    sort?: 'new' | 'hot' | 'top' | 'best' | 'controversial' | 'rising';
    time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  } = {}): Promise<any> {
    const params: any = {
      limit: options.limit || 100
    };
    
    if (options.after) params.after = options.after;
    if (options.time) params.t = options.time;
    
    const sort = options.sort || 'new';
    
    return this.get(`/r/${subreddit}/${sort}.json`, params);
  }

  async getAllSubredditPosts(subreddit: string, options: {
    maxPosts?: number;
    sort?: 'new' | 'hot' | 'top' | 'best' | 'controversial' | 'rising';
    time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  } = {}): Promise<any[]> {
    const maxPosts = options.maxPosts || 1000;
    let allPosts: any[] = [];
    let after: string | undefined = undefined;
    
    this.logger.info(`Fetching up to ${maxPosts} posts from r/${subreddit}`);
    
    while (allPosts.length < maxPosts) {
      const data = await this.getSubredditPosts(subreddit, {
        limit: 100,
        after,
        sort: options.sort,
        time: options.time
      });
      
      const posts = data.data.children;
      
      if (posts.length === 0) break;
      
      allPosts = [...allPosts, ...posts];
      after = data.data.after || undefined;
      
      this.logger.debug(`Fetched batch of ${posts.length} posts, total so far: ${allPosts.length}`);
      
      if (!after) break;
    }
    
    return allPosts.slice(0, maxPosts);
  }

  async getPostComments(postId: string, options: {
    sort?: 'confidence' | 'top' | 'new' | 'controversial' | 'old';
    limit?: number;
  } = {}): Promise<any> {
    const params: any = {};
    
    if (options.sort) params.sort = options.sort;
    if (options.limit) params.limit = options.limit;
    
    return this.get(`/comments/${postId}.json`, params);
  }
} 