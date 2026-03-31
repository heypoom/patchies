import { get } from 'svelte/store';
import { match } from 'ts-pattern';
import { aiSettings } from '../../../stores/ai-settings.store';
import { GeminiProvider } from './gemini-provider';
import { OpenRouterProvider } from './openrouter-provider';

export type { LLMProvider, LLMMessage, LLMStreamOptions } from './types';
export { GeminiProvider } from './gemini-provider';
export { OpenRouterProvider } from './openrouter-provider';

/**
 * Returns an LLMProvider for general text generation based on the user's active AI settings.
 * Throws if no API key is configured.
 *
 * @param modelOverride  Optional model ID to use instead of the configured default.
 */
export function getTextProvider(modelOverride?: string) {
  const settings = get(aiSettings);

  return match(settings.provider)
    .with('openrouter', () => {
      if (!settings.openRouterApiKey) {
        throw new Error('OpenRouter API key is not set. Please configure it in AI settings.');
      }
      return new OpenRouterProvider(
        settings.openRouterApiKey,
        modelOverride ?? settings.openRouterTextModel
      );
    })
    .otherwise(() => {
      if (!settings.geminiApiKey) {
        throw new Error('Gemini API key is not set. Please set it in the settings.');
      }
      return new GeminiProvider(settings.geminiApiKey, modelOverride);
    });
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
