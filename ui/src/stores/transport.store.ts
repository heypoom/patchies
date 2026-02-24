import { writable } from 'svelte/store';
import { DEFAULT_BPM } from '$lib/transport/constants';

const STORAGE_KEY = 'patchies:transport';

export type TimeDisplayFormat = 'seconds' | 'bars';

export interface TransportStoreState {
  bpm: number;
  timeDisplayFormat: TimeDisplayFormat;
  panelOpen: boolean;
}

const defaultState: TransportStoreState = {
  bpm: DEFAULT_BPM,
  timeDisplayFormat: 'seconds',
  panelOpen: false
};

function loadFromStorage(): TransportStoreState {
  if (typeof localStorage === 'undefined') return defaultState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultState;
    const parsed = JSON.parse(stored);
    return {
      bpm: parsed.bpm ?? DEFAULT_BPM,
      timeDisplayFormat: parsed.timeDisplayFormat ?? 'seconds',
      panelOpen: false // Always start closed
    };
  } catch {
    console.warn('Failed to load transport state from localStorage');
    return defaultState;
  }
}

function saveToStorage(state: TransportStoreState): void {
  if (typeof localStorage === 'undefined') return;

  try {
    // Don't persist panelOpen state
    const { panelOpen: _, ...persistedState } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  } catch (e) {
    console.error('Failed to save transport state to localStorage', e);
  }
}

function createTransportStore() {
  const { subscribe, update, set } = writable<TransportStoreState>(loadFromStorage());

  // Auto-save to localStorage on changes
  subscribe((state) => {
    saveToStorage(state);
  });

  return {
    subscribe,
    set,
    update,

    setBpm(bpm: number) {
      update((s) => ({ ...s, bpm }));
    },

    setTimeDisplayFormat(format: TimeDisplayFormat) {
      update((s) => ({ ...s, timeDisplayFormat: format }));
    },

    toggleTimeDisplayFormat() {
      update((s) => ({
        ...s,
        timeDisplayFormat: s.timeDisplayFormat === 'seconds' ? 'bars' : 'seconds'
      }));
    },

    setPanelOpen(open: boolean) {
      update((s) => ({ ...s, panelOpen: open }));
    },

    togglePanel() {
      update((s) => ({ ...s, panelOpen: !s.panelOpen }));
    }
  };
}

export const transportStore = createTransportStore();
