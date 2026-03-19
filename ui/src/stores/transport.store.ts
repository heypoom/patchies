import { writable } from 'svelte/store';
import { match } from 'ts-pattern';
import { DEFAULT_AUTOPLAY, DEFAULT_BPM, DEFAULT_TIME_SIGNATURE } from '$lib/transport/constants';
import _ from 'lodash';

const STORAGE_KEY = 'patchies:transport';

export type TimeDisplayFormat = 'seconds' | 'bars' | 'time';
export type TransportPlayState = 'playing' | 'paused' | 'stopped';

const DEFAULT_TIME_DISPLAY_FORMAT: TimeDisplayFormat = 'time';

export interface TransportStoreState {
  bpm: number;
  timeSignature: [numerator: number, denominator: number];
  timeDisplayFormat: TimeDisplayFormat;
  panelOpen: boolean;
  isPlaying: boolean;
  playState: TransportPlayState;
  dspEnabled: boolean;
  timelineVisible: boolean;
  volume: number;
  isMuted: boolean;
  previousVolume: number;
}

const defaultState: TransportStoreState = {
  bpm: DEFAULT_BPM,
  timeSignature: DEFAULT_TIME_SIGNATURE,
  timeDisplayFormat: DEFAULT_TIME_DISPLAY_FORMAT,
  panelOpen: false,
  isPlaying: DEFAULT_AUTOPLAY,
  playState: DEFAULT_AUTOPLAY ? 'playing' : 'stopped',
  dspEnabled: true,
  timelineVisible: false,
  volume: 0.8,
  isMuted: false,
  previousVolume: 0.8
};

function loadFromStorage(): TransportStoreState {
  if (typeof localStorage === 'undefined') return defaultState;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultState;

    const parsed: TransportStoreState = JSON.parse(stored);

    return {
      bpm: parsed.bpm ?? DEFAULT_BPM,
      timeSignature: parsed.timeSignature ?? DEFAULT_TIME_SIGNATURE,
      timeDisplayFormat: parsed.timeDisplayFormat ?? DEFAULT_TIME_DISPLAY_FORMAT,
      panelOpen: false, // Always start closed
      isPlaying: DEFAULT_AUTOPLAY,
      playState: DEFAULT_AUTOPLAY ? 'playing' : 'stopped',
      dspEnabled: parsed.dspEnabled ?? true,
      timelineVisible: parsed.timelineVisible === true,
      volume: parsed.volume ?? 0.8,
      isMuted: parsed.isMuted ?? false,
      previousVolume: parsed.previousVolume ?? 0.8
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_.omit(state, 'panelOpen')));
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

    setTimeSignature(numerator: number, denominator: number) {
      update((s) => ({ ...s, timeSignature: [numerator, denominator] as [number, number] }));
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

    setPlayState(playState: TransportPlayState) {
      const isPlaying = match(playState)
        .with('playing', () => true)
        .otherwise(() => false);
      update((s) => ({ ...s, playState, isPlaying }));
    },

    setDspEnabled(dspEnabled: boolean) {
      update((s) => ({ ...s, dspEnabled }));
    },

    setVolume(volume: number) {
      update((s) => ({ ...s, volume }));
    },

    setMuted(isMuted: boolean) {
      update((s) => ({ ...s, isMuted }));
    },

    toggleMute() {
      update((s) => {
        if (s.isMuted || s.volume === 0) {
          const restoreVolume = s.previousVolume === 0 ? 0.5 : s.previousVolume;
          return { ...s, isMuted: false, volume: restoreVolume };
        } else {
          return { ...s, isMuted: true, previousVolume: s.volume };
        }
      });
    },

    toggleTimeline() {
      update((s) => ({ ...s, timelineVisible: !s.timelineVisible }));
    }
  };
}

export const transportStore = createTransportStore();
