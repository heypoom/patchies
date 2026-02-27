import { writable } from 'svelte/store';
import {
  DEFAULT_AUTOPLAY,
  DEFAULT_BPM,
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_DENOMINATOR
} from '$lib/transport/constants';

const STORAGE_KEY = 'patchies:transport';

export type TimeDisplayFormat = 'seconds' | 'bars' | 'time';

const DEFAULT_TIME_DISPLAY_FORMAT: TimeDisplayFormat = 'time';

export interface TransportStoreState {
  bpm: number;
  beatsPerBar: number;
  denominator: number;
  timeDisplayFormat: TimeDisplayFormat;
  panelOpen: boolean;
  isPlaying: boolean;
  dspEnabled: boolean;
}

const defaultState: TransportStoreState = {
  bpm: DEFAULT_BPM,
  beatsPerBar: DEFAULT_BEATS_PER_BAR,
  denominator: DEFAULT_DENOMINATOR,
  timeDisplayFormat: DEFAULT_TIME_DISPLAY_FORMAT,
  panelOpen: false,
  isPlaying: DEFAULT_AUTOPLAY,
  dspEnabled: true
};

function loadFromStorage(): TransportStoreState {
  if (typeof localStorage === 'undefined') return defaultState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultState;
    const parsed = JSON.parse(stored);
    return {
      bpm: parsed.bpm ?? DEFAULT_BPM,
      beatsPerBar: parsed.beatsPerBar ?? DEFAULT_BEATS_PER_BAR,
      denominator: parsed.denominator ?? DEFAULT_DENOMINATOR,
      timeDisplayFormat: parsed.timeDisplayFormat ?? DEFAULT_TIME_DISPLAY_FORMAT,
      panelOpen: false, // Always start closed
      isPlaying: DEFAULT_AUTOPLAY,
      dspEnabled: true
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

    setBeatsPerBar(beatsPerBar: number) {
      update((s) => ({ ...s, beatsPerBar }));
    },

    setTimeSignature(beatsPerBar: number, denominator: number) {
      update((s) => ({ ...s, beatsPerBar, denominator }));
    },

    setTimeDisplayFormat(format: TimeDisplayFormat) {
      update((s) => ({ ...s, timeDisplayFormat: format }));
    },

    toggleTimeDisplayFormat() {
      update((s) => {
        const formats: TimeDisplayFormat[] = ['time', 'bars', 'seconds'];
        const currentIndex = formats.indexOf(s.timeDisplayFormat);
        const nextIndex = (currentIndex + 1) % formats.length;
        return { ...s, timeDisplayFormat: formats[nextIndex] };
      });
    },

    setPanelOpen(open: boolean) {
      update((s) => ({ ...s, panelOpen: open }));
    },

    togglePanel() {
      update((s) => ({ ...s, panelOpen: !s.panelOpen }));
    },

    setIsPlaying(isPlaying: boolean) {
      update((s) => ({ ...s, isPlaying }));
    },

    setDspEnabled(dspEnabled: boolean) {
      update((s) => ({ ...s, dspEnabled }));
    }
  };
}

export const transportStore = createTransportStore();
