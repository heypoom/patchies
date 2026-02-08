import { writable } from 'svelte/store';

const STORAGE_KEY = 'patchies:help-view-state';

export type LastViewed =
  | { type: 'topic'; topic: string }
  | { type: 'object'; object: string }
  | null;

export interface HelpViewState {
  lastViewed: LastViewed;
  guidesExpanded: boolean;
  objectsExpanded: boolean;
  isLocked: boolean;
}

const defaultState: HelpViewState = {
  lastViewed: null,
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
      lastViewed: parsed.lastViewed ?? null,
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

    setLastViewed(lastViewed: LastViewed) {
      update((s) => ({ ...s, lastViewed }));
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
