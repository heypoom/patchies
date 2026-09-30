import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  const items = new Map<string, string>();

  vi.resetModules();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key)
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('Gemini speech model settings', () => {
  it('uses the default speech model when existing settings do not specify one', async () => {
    localStorage.setItem('ai-settings', JSON.stringify({ geminiApiKey: 'test-key' }));

    const { aiSettings, DEFAULT_GEMINI_SPEECH_MODEL } = await import('./ai-settings.store');

    expect(get(aiSettings).geminiSpeechModel).toBe(DEFAULT_GEMINI_SPEECH_MODEL);
    expect(aiSettings.getGeminiApiKey()).toBe('test-key');
  });

  it('persists and reloads custom speech models independently of the selected provider', async () => {
    const { aiSettings } = await import('./ai-settings.store');

    aiSettings.updateSettings({
      provider: 'openrouter',
      geminiApiKey: 'gemini-key',
      openRouterApiKey: 'openrouter-key',
      geminiSpeechModel: 'custom-tts-model'
    });
    vi.resetModules();

    const { aiSettings: reloaded } = await import('./ai-settings.store');

    expect(get(reloaded).geminiSpeechModel).toBe('custom-tts-model');
    expect(reloaded.getGeminiApiKey()).toBe('gemini-key');
    expect(reloaded.getActiveApiKey()).toBe('openrouter-key');
  });

  it('omits the default speech model from storage so future defaults can take effect', async () => {
    const { aiSettings, DEFAULT_GEMINI_SPEECH_MODEL } = await import('./ai-settings.store');

    aiSettings.updateSettings({ geminiSpeechModel: 'gemini-3.8-flash-lite-tts' });
    aiSettings.updateSettings({ geminiSpeechModel: DEFAULT_GEMINI_SPEECH_MODEL });

    expect(JSON.parse(localStorage.getItem('ai-settings')!)).not.toHaveProperty(
      'geminiSpeechModel'
    );
    expect(get(aiSettings).geminiSpeechModel).toBe(DEFAULT_GEMINI_SPEECH_MODEL);
  });
});
