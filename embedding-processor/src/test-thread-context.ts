import { buildThreadContext, createThreadEnhancedInput } from './services/thread-context';
import { ParentComment } from './services/types';

function test() {
  // Sample post
  const post = {
    id: 'post123',
    title: 'Discussion about SpaceX Starship',
    content: 'SpaceX has made significant progress on the Starship program. What do you think about the latest developments?',
    subreddit: 'space'
  };
  
  // Sample parent comments
  const parentComments: ParentComment[] = [
    {
      id: 'comment1',
      content: 'I think the Starship will revolutionize space travel.'
    },
    {
      id: 'comment2',
      content: 'The landing system still needs work though.'
    }
  ];
  
  // Build thread context
  const threadContext = buildThreadContext('comment3', post, parentComments);
  console.log('Thread Context:', JSON.stringify(threadContext, null, 2));
  
  // Test enhanced input generation
  const entityTags = {
    topics: ['Space Travel', 'Rockets', 'SpaceX'],
    locations: ['Mars'],
    semanticTags: ['technology', 'innovation', 'aerospace']
  };
  
  const commentContent = 'I agree with the previous comments. The heat shield tiles are also a concern.';
  
  const enhancedInput = createThreadEnhancedInput(commentContent, threadContext, entityTags);
  console.log('\nEnhanced Input:');
  console.log(enhancedInput);
}

test(); 