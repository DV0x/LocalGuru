import { createEmbedding } from './services/embedding-service';

async function test() {
  const embedding = await createEmbedding('This is a test text for embedding generation');
  console.log(`Generated embedding with ${embedding.length} dimensions`);
  console.log(embedding.slice(0, 5)); // Show first 5 dimensions
}

test().catch(console.error); 