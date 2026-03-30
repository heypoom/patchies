import { get } from 'svelte/store';
import { aiSettings } from '../../../stores/ai-settings.store';
import { GeminiProvider } from './gemini-provider';
import { OpenRouterProvider } from './openrouter-provider';

export type { LLMProvider, LLMMessage, LLMStreamOptions } from './types';
export { GeminiProvider } from './gemini-provider';
export { OpenRouterProvider } from './openrouter-provider';

/**
 * Returns an LLMProvider for general text generation based on the user's active AI settings.
 * Throws if no API key is configured.
 */
export function getTextProvider() {
  const settings = get(aiSettings);

  if (settings.provider === 'openrouter') {
    if (!settings.openRouterApiKey) {
      throw new Error('OpenRouter API key is not set. Please configure it in AI settings.');
    }
    return new OpenRouterProvider(settings.openRouterApiKey, settings.openRouterModel);
  }

  if (!settings.geminiApiKey) {
    throw new Error('Gemini API key is not set. Please set it in the settings.');
  }

  return new GeminiProvider(settings.geminiApiKey);
}

/**
 * Returns the Gemini API key for Gemini-specific features (image generation, music, STT).
 * Throws if no Gemini key is configured.
 */
export function requireGeminiApiKey(): string {
  const settings = get(aiSettings);
  if (!settings.geminiApiKey) {
    throw new Error('Gemini API key is not set. Please set it in the settings.');
  }
  return settings.geminiApiKey;
}
