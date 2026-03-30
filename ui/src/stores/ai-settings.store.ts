import { writable, derived, get } from 'svelte/store';

export type AIProviderType = 'gemini' | 'openrouter';

export const DEFAULT_GEMINI_TEXT_MODEL = 'gemini-3-flash-preview';
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

export const DEFAULT_OPENROUTER_TEXT_MODEL = 'google/gemini-3-flash-preview';
export const DEFAULT_OPENROUTER_IMAGE_MODEL = 'google/gemini-3.1-flash-image-preview';

export interface AISettings {
  provider: AIProviderType;
  geminiApiKey: string;
  openRouterApiKey: string;
  openRouterTextModel: string;
  openRouterImageModel: string;
}

const STORAGE_KEY = 'ai-settings';
const LEGACY_GEMINI_KEY = 'gemini-api-key';

const DEFAULT_SETTINGS: AISettings = {
  provider: 'gemini',
  geminiApiKey: '',
  openRouterApiKey: '',
  openRouterTextModel: DEFAULT_OPENROUTER_TEXT_MODEL,
  openRouterImageModel: DEFAULT_OPENROUTER_IMAGE_MODEL
};

function loadAISettings(): AISettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const parsed = JSON.parse(stored);

      // Migrate: openRouterModel → openRouterTextModel
      if (parsed.openRouterModel && !parsed.openRouterTextModel) {
        parsed.openRouterTextModel = parsed.openRouterModel;
        delete parsed.openRouterModel;
      }

      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // ignore parse errors
  }

  // Migrate from legacy gemini-api-key
  const legacyKey = localStorage.getItem(LEGACY_GEMINI_KEY) ?? '';

  return { ...DEFAULT_SETTINGS, geminiApiKey: legacyKey };
}

function saveAISettings(settings: AISettings) {
  // Don't persist model fields that equal the current defaults —
  // so changing a default constant takes effect without clearing localStorage.
  const toSave: Partial<AISettings> = { ...settings };

  if (toSave.openRouterTextModel === DEFAULT_OPENROUTER_TEXT_MODEL) {
    delete toSave.openRouterTextModel;
  }

  if (toSave.openRouterImageModel === DEFAULT_OPENROUTER_IMAGE_MODEL) {
    delete toSave.openRouterImageModel;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));

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
export const hasAIApiKey = derived(aiSettings, (settings) =>
  settings.provider === 'openrouter' ? !!settings.openRouterApiKey : !!settings.geminiApiKey
);
