import dotenv from 'dotenv';
import { ChangeDetector } from '../processors';
import { Logger } from '../utils/logger';

// Load environment variables
dotenv.config();

async function main() {
  const logger = new Logger('ChangeDetectorTest');
  
  logger.info('Testing Change Detector');
  
  // Initialize the change detector
  const changeDetector = new ChangeDetector({
    checksumFields: ['title', 'content', 'score'],
    ignoreFields: ['last_updated'],
    forceUpdateAfterDays: 7
  });
  
  // Create some test data
  const now = new Date();
  const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  
  const existingPosts = new Map();
  existingPosts.set('post1', {
    id: 'post1',
    title: 'Existing Post 1',
    content: 'This is post 1 content',
    score: 10,
    content_checksum: '123456',
    last_checked: sixDaysAgo, // Will not need forced update
    update_count: 1
  });
  
  existingPosts.set('post2', {
    id: 'post2',
    title: 'Existing Post 2',
    content: 'This is post 2 content',
    score: 20,
    content_checksum: '789012',
    last_checked: eightDaysAgo, // Will need forced update due to age
    update_count: 2
  });
  
  existingPosts.set('post3', {
    id: 'post3',
    title: 'Existing Post 3',
    content: 'This is post 3 content',
    score: 30,
    content_checksum: '345678',
    last_checked: now,
    update_count: 0
  });
  
  // New batch of posts
  const newPosts = [
    {
      id: 'post1',
      title: 'Existing Post 1', // Same title
      content: 'This is post 1 content with changes', // Content changed
      score: 15, // Score changed
      subreddit: 'test'
    },
    {
      id: 'post2',
      title: 'Existing Post 2',
      content: 'This is post 2 content',
      score: 20, // Same content, but post is old enough for a forced update
      subreddit: 'test'
    },
    {
      id: 'post3',
      title: 'Existing Post 3',
      content: 'This is post 3 content',
      score: 30, // No changes
      subreddit: 'test'
    },
    {
      id: 'post4',
      title: 'New Post 4',
      content: 'This is a new post',
      score: 5,
      subreddit: 'test'
    }
  ];
  
  // Detect changes
  logger.info('Detecting changes...');
  const changes = await changeDetector.detectPostChanges(newPosts, existingPosts);
  
  // Log results
  logger.info('Change detection results:', {
    newCount: changes.new.length,
    updatedCount: changes.updated.length,
    unchangedCount: changes.unchanged.length
  });
  
  logger.info('New posts:', changes.new.map(p => p.id));
  logger.info('Updated posts:', changes.updated.map(p => ({
    id: p.id,
    update_count: p.update_count,
    reason: p.id === 'post1' ? 'content changed' : 'forced update due to age'
  })));
  logger.info('Unchanged posts:', changes.unchanged.map(p => p.id));
  
  // Verify checksums were set
  for (const post of [...changes.new, ...changes.updated, ...changes.unchanged]) {
    logger.info(`Post ${post.id} checksum: ${post.content_checksum}`);
  }
  
  logger.info('Change Detector test completed');
}

// Run the test
main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 