import axios from 'axios';
import { delay } from '../utils/helpers';
import { Logger } from '../utils/logger';

export interface RedditAPIConfig {
  userAgent: string;
  clientId?: string;
  clientSecret?: string;
  requestDelay?: number;
}

export class RedditAPI {
  private userAgent: string;
  private auth: any;
  private requestDelay: number;
  private lastRequestTime: number = 0;
  private logger: Logger;
  private maxRetries: number = 3;
  private initialRetryDelay: number = 1000;
  private maxRetryDelay: number = 30000;

  constructor(config: RedditAPIConfig) {
    this.userAgent = config.userAgent;
    this.requestDelay = config.requestDelay || 2000;
    this.logger = new Logger('RedditAPI');
    
    if (config.clientId && config.clientSecret) {
      this.auth = {
        username: config.clientId,
        password: config.clientSecret
      };
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

  async get(endpoint: string, params: any = {}): Promise<any> {
    await this.respectRateLimit();
    
    let lastError: any = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.get(`https://www.reddit.com${endpoint}`, {
          params: {
            ...params,
            raw_json: 1
          },
          headers: {
            'User-Agent': this.userAgent
          },
          auth: this.auth,
          timeout: 15000
        });
        
        return response.data;
      } catch (error: any) {
        lastError = error;
        
        this.logger.error(`Reddit API error (attempt ${attempt + 1}/${this.maxRetries + 1}): ${error.message}`);
        
        if (attempt === this.maxRetries) {
          throw new Error(`Reddit API error after ${this.maxRetries + 1} attempts: ${error.message}`);
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
          throw error;
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
    sort?: 'new' | 'hot' | 'top';
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
    sort?: 'new' | 'hot' | 'top';
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