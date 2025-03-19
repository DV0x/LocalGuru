import { getSearchSynthesisPrompt, getAvailablePromptVersions, printAllPrompts, PromptVersion } from './search-synthesis-prompt';

// Test the prompts by printing them
console.log('Available prompt versions:', getAvailablePromptVersions());
console.log('\nTesting all prompts:');
printAllPrompts();

// Sample usage in an application
console.log('\nSample usage in application:');
const defaultPrompt = getSearchSynthesisPrompt();
console.log(`Length of default prompt: ${defaultPrompt.length} characters`);

const concisePrompt = getSearchSynthesisPrompt('concise');
console.log(`Length of concise prompt: ${concisePrompt.length} characters`);

// Test non-existent prompt version (should return default)
// @ts-ignore - We're intentionally testing the fallback behavior
const nonExistentPrompt = getSearchSynthesisPrompt('non-existent' as PromptVersion);
console.log(`Default fallback working: ${nonExistentPrompt === defaultPrompt}`);

console.log('\nPrompt testing complete!'); 