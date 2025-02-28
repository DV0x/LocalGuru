import OpenAI from 'openai';

// Environment variables should be defined in .env.local
const apiKey = process.env.OPENAI_API_KEY;

// Ensure environment variables are defined
if (!apiKey) {
  throw new Error('Missing OpenAI API key');
}

// Create an OpenAI client
export const openai = new OpenAI({
  apiKey,
});

// Function to generate embeddings for a text
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

// Function to generate a response using the LLM
export async function generateResponse(prompt: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful travel assistant providing accurate and concise information about travel destinations.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });
    
    return completion.choices[0].message.content || '';
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error('Failed to generate response');
  }
} 