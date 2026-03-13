import { writable } from 'svelte/store';

const STORAGE_KEY = 'patchies:profiler-settings';

export type DisplayStat = 'avg' | 'max' | 'p95' | 'last' | 'calls/s';

interface ProfilerSettings {
  focusOnSelect: boolean;
  displayStat: DisplayStat;
}

const DISPLAY_STATS: DisplayStat[] = ['avg', 'max', 'p95', 'last', 'calls/s'];

const defaults: ProfilerSettings = {
  focusOnSelect: false,
  displayStat: 'avg'
};

function load(): ProfilerSettings {
  if (typeof localStorage === 'undefined') return defaults;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored);
    return {
      focusOnSelect: parsed.focusOnSelect ?? defaults.focusOnSelect,
      displayStat: DISPLAY_STATS.includes(parsed.displayStat)
        ? parsed.displayStat
        : defaults.displayStat
    };
  } catch {
    return defaults;
  }
}

function createProfilerSettingsStore() {
  const { subscribe, update } = writable<ProfilerSettings>(load());

  subscribe((state) => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  });

  return {
    subscribe,
    toggleFocusOnSelect() {
      update((s) => ({ ...s, focusOnSelect: !s.focusOnSelect }));
    },
    nextDisplayStat() {
      update((s) => {
        const idx = DISPLAY_STATS.indexOf(s.displayStat);
        return { ...s, displayStat: DISPLAY_STATS[(idx + 1) % DISPLAY_STATS.length] };
      });
    }
  };
}

export const profilerSettings = createProfilerSettingsStore();
