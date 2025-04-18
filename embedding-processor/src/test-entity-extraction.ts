import { extractEntities } from './services/entity-extraction';

async function test() {
  const result = await extractEntities(
    'SpaceX successfully launched the Starship rocket from Texas today. Elon Musk was thrilled with the test flight results.',
    'post',
    { subreddit: 'space', title: 'SpaceX Starship Launch' }
  );
  
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error); 