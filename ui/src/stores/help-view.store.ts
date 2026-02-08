import { writable } from 'svelte/store';

const STORAGE_KEY = 'patchies:help-view-state';

export interface HelpViewState {
  lastViewedType: string | null;
  lastViewedTopic: string | null;
  guidesExpanded: boolean;
  objectsExpanded: boolean;
  isLocked: boolean;
}

const defaultState: HelpViewState = {
  lastViewedType: null,
  lastViewedTopic: null,
  guidesExpanded: false,
  objectsExpanded: true,
  isLocked: false
};

function loadFromStorage(): HelpViewState {
  if (typeof localStorage === 'undefined') return defaultState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultState;
    const parsed = JSON.parse(stored);
    return {
      lastViewedType: parsed.lastViewedType ?? null,
      lastViewedTopic: parsed.lastViewedTopic ?? null,
      guidesExpanded: parsed.guidesExpanded ?? false,
      objectsExpanded: parsed.objectsExpanded ?? true,
      isLocked: parsed.isLocked ?? false
    };
  } catch {
    console.warn('Failed to load help view state from localStorage');
    return defaultState;
  }
}

function saveToStorage(state: HelpViewState): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save help view state to localStorage', e);
  }
}

function createHelpViewStore() {
  const { subscribe, update, set } = writable<HelpViewState>(loadFromStorage());

  // Auto-save to localStorage on changes
  subscribe((state) => {
    saveToStorage(state);
  });

  return {
    subscribe,
    set,
    update,

    setLastViewedType(type: string | null) {
      update((s) => ({ ...s, lastViewedType: type, lastViewedTopic: null }));
    },

    setLastViewedTopic(topic: string | null) {
      update((s) => ({ ...s, lastViewedTopic: topic, lastViewedType: null }));
    },

    setGuidesExpanded(expanded: boolean) {
      update((s) => ({ ...s, guidesExpanded: expanded }));
    },

    setObjectsExpanded(expanded: boolean) {
      update((s) => ({ ...s, objectsExpanded: expanded }));
    },

    setLocked(locked: boolean) {
      update((s) => ({ ...s, isLocked: locked }));
    }
  };
}

export const helpViewStore = createHelpViewStore();
