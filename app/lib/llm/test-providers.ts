import { getLLMProvider, LLMProvider, LLMModel, getDefaultLLMConfig } from './providers';

/**
 * Test utility to validate provider configurations
 */
export function testProviderConfigurations() {
  console.log('Testing LLM Provider Configurations:');
  
  // Test default configuration from environment
  const defaultConfig = getDefaultLLMConfig();
  console.log('Default config from environment:', defaultConfig);
  
  // Test Anthropic provider configurations
  const providers: LLMProvider[] = ['anthropic', 'openai'];
  const models: Record<LLMProvider, LLMModel[]> = {
    'anthropic': ['claude-3-sonnet', 'claude-3-opus', 'claude-3-haiku'],
    'openai': ['gpt-4-turbo', 'gpt-4o']
  };
  
  // Test all combinations
  providers.forEach(provider => {
    console.log(`\nTesting ${provider} provider:`);
    
    models[provider].forEach(model => {
      const config = getLLMProvider(provider, model);
      console.log(`- ${model}: maxTokens=${config.maxTokens}, temperature=${config.temperature}`);
    });
    
    // Test cross-model handling (should auto-correct to appropriate model)
    if (provider === 'anthropic') {
      const config = getLLMProvider(provider, 'gpt-4-turbo');
      console.log(`- Cross-model test (gpt model with anthropic): ${config.modelName}`);
    } else {
      const config = getLLMProvider(provider, 'claude-3-sonnet');
      console.log(`- Cross-model test (claude model with openai): ${config.modelName}`);
    }
  });
  
  console.log('\nAll provider configurations tested successfully!');
}

// Run test if this file is executed directly
if (require.main === module) {
  testProviderConfigurations();
} 