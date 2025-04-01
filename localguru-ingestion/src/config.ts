export const config = {
  reddit: {
    userAgent: process.env.REDDIT_USER_AGENT || 'Localguru/1.0',
    requestDelay: parseInt(process.env.REDDIT_REQUEST_DELAY || '2000', 10),
    initialSubreddit: 'AskSF',
  },
  
  changeDetection: {
    checksumFields: ['title', 'content', 'score', 'upvote_ratio'],
    ignoreFields: ['last_updated', 'last_checked', 'content_checksum'],
    forceUpdateAfterDays: 7,
  },
  
  database: {
    batchSize: 50,
    retryAttempts: 3,
    disableTriggers: true,
  },
  
  queue: {
    priorityMapping: {
      post: 8,
      comment: 5,
      updated_post: 9,
      updated_comment: 6,
    },
    defaultPriority: 5,
    maxQueueSize: 10000,
    cooldownMinutes: 60,
  },
  
  processQueue: {
    triggerAfterIngestion: true,
    batchSize: 50,
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    logToFile: process.env.LOG_TO_FILE === 'true',
    logDirectory: './logs',
  },
}; 