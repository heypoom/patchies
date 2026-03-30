import { writable, derived, get } from 'svelte/store';

export type AIProviderType = 'gemini' | 'openrouter';

export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash-preview-05-20';

export interface AISettings {
  provider: AIProviderType;
  geminiApiKey: string;
  openRouterApiKey: string;
  openRouterModel: string;
}

const STORAGE_KEY = 'ai-settings';
const LEGACY_GEMINI_KEY = 'gemini-api-key';

const DEFAULT_SETTINGS: AISettings = {
  provider: 'gemini',
  geminiApiKey: '',
  openRouterApiKey: '',
  openRouterModel: DEFAULT_OPENROUTER_MODEL
};

function loadAISettings(): AISettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    // ignore parse errors
  }

  // Migrate from legacy gemini-api-key
  const legacyKey = localStorage.getItem(LEGACY_GEMINI_KEY) ?? '';

  return { ...DEFAULT_SETTINGS, geminiApiKey: legacyKey };
}

function saveAISettings(settings: AISettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  // Keep legacy key in sync for Gemini-specific features (image gen, music, STT)
  if (settings.geminiApiKey) {
    localStorage.setItem(LEGACY_GEMINI_KEY, settings.geminiApiKey);
  }
}

function createAISettingsStore() {
  const initial = typeof localStorage !== 'undefined' ? loadAISettings() : DEFAULT_SETTINGS;
  const { subscribe, update } = writable<AISettings>(initial);

  return {
    subscribe,

    updateSettings(patch: Partial<AISettings>) {
      update((s) => {
        const next = { ...s, ...patch };
        saveAISettings(next);
        return next;
      });
    },

    /** Returns the API key for the currently active provider. */
    getActiveApiKey(): string {
      const s = get({ subscribe });
      return s.provider === 'openrouter' ? s.openRouterApiKey : s.geminiApiKey;
    },

    /** Returns true if the active provider has an API key set. */
    hasApiKey(): boolean {
      return !!this.getActiveApiKey();
    },

    /** Returns the Gemini API key (for Gemini-specific features like image gen, music, STT). */
    getGeminiApiKey(): string {
      return get({ subscribe }).geminiApiKey;
    }
  };
}

export const aiSettings = createAISettingsStore();

/** Reactive derived: true if the active provider has an API key configured. */
export const hasAIApiKey = derived(aiSettings, (s) =>
  s.provider === 'openrouter' ? !!s.openRouterApiKey : !!s.geminiApiKey
);
