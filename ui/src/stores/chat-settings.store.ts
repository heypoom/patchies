import { writable } from 'svelte/store';

const STORAGE_KEY = 'patchies:chat-settings';

export interface ChatSettings {
  expandThinking: boolean;
}

const defaultSettings: ChatSettings = {
  expandThinking: false
};

function load(): ChatSettings {
  if (typeof localStorage === 'undefined') return defaultSettings;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultSettings;
    const parsed = JSON.parse(stored);
    return {
      expandThinking: parsed.expandThinking ?? false
    };
  } catch {
    return defaultSettings;
  }
}

function save(settings: ChatSettings): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function createChatSettingsStore() {
  const { subscribe, update } = writable<ChatSettings>(load());

  subscribe((s) => save(s));

  return {
    subscribe,
    toggleExpandThinking() {
      update((s) => ({ ...s, expandThinking: !s.expandThinking }));
    }
  };
}

export const chatSettingsStore = createChatSettingsStore();
