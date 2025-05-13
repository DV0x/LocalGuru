import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

export type LLMProvider = 'anthropic' | 'openai';
export type LLMModel = 'claude-3-sonnet' | 'claude-3-opus' | 'claude-3-haiku' | 'gpt-4-turbo' | 'gpt-4o';

export interface LLMConfig {
  model: any; // Model instance from AI SDK
  maxTokens: number;
  temperature: number;
  providerName: string;
  modelName: string;
}

/**
 * Get provider configuration based on the specified provider and model
 */
export function getLLMProvider(
  provider: LLMProvider = 'anthropic',
  model: LLMModel = 'claude-3-sonnet',
  temperature: number = 0.7
): LLMConfig {
  // Model mappings
  const modelConfigs: Record<LLMModel, { maxTokens: number, modelId: string }> = {
    'claude-3-sonnet': { maxTokens: 4000, modelId: 'claude-3-sonnet-20240229' },
    'claude-3-opus': { maxTokens: 4000, modelId: 'claude-3-opus-20240229' },
    'claude-3-haiku': { maxTokens: 4000, modelId: 'claude-3-haiku-20240307' },
    'gpt-4-turbo': { maxTokens: 4096, modelId: 'gpt-4-turbo-preview' },
    'gpt-4o': { maxTokens: 4096, modelId: 'gpt-4o' }
  };

  const modelConfig = modelConfigs[model];

  switch (provider) {
    case 'anthropic':
      if (!model.startsWith('claude')) {
        return getLLMProvider('anthropic', 'claude-3-sonnet', temperature);
      }
      return {
        model: anthropic(modelConfig.modelId),
        maxTokens: modelConfig.maxTokens,
        temperature,
        providerName: 'anthropic',
        modelName: model
      };
    case 'openai':
      if (!model.startsWith('gpt')) {
        return getLLMProvider('openai', 'gpt-4-turbo', temperature);
      }
      return {
        model: openai(modelConfig.modelId),
        maxTokens: modelConfig.maxTokens,
        temperature,
        providerName: 'openai',
        modelName: model
      };
    default:
      return getLLMProvider('anthropic', 'claude-3-sonnet', temperature);
  }
}

/**
 * Execute an operation with fallback to another provider if the primary fails
 * 
 * @param primaryProvider The primary LLM provider to use
 * @param primaryModel The model to use with the primary provider
 * @param operation The function to execute with the configured model
 * @param fallbackProvider Optional fallback provider in case of failure
 * @param fallbackModel Optional fallback model to use with the fallback provider
 * @returns The result of the operation
 */
export async function withProviderFallback<T>(
  primaryProvider: LLMProvider,
  primaryModel: LLMModel,
  operation: (config: LLMConfig) => Promise<T>,
  fallbackProvider?: LLMProvider,
  fallbackModel?: LLMModel
): Promise<T> {
  try {
    // Try primary provider
    const config = getLLMProvider(primaryProvider, primaryModel);
    return await operation(config);
  } catch (error) {
    console.error(`Error with primary provider ${primaryProvider}:`, error);
    
    // Try fallback if specified
    if (fallbackProvider) {
      console.log(`Falling back to ${fallbackProvider}...`);
      const fallbackConfig = getLLMProvider(
        fallbackProvider, 
        fallbackModel || (fallbackProvider === 'anthropic' ? 'claude-3-sonnet' : 'gpt-4-turbo')
      );
      return await operation(fallbackConfig);
    }
    
    // Re-throw if no fallback
    throw error;
  }
}

/**
 * Helper function to get the default LLM configuration from environment variables
 */
export function getDefaultLLMConfig(): { provider: LLMProvider; model: LLMModel; temperature: number } {
  return {
    provider: (process.env.DEFAULT_LLM_PROVIDER as LLMProvider) || 'anthropic',
    model: (process.env.DEFAULT_LLM_MODEL as LLMModel) || 'claude-3-sonnet',
    temperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.7')
  };
} 