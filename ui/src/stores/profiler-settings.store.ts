import { writable } from 'svelte/store';

const STORAGE_KEY = 'patchies:profiler-settings';

interface ProfilerSettings {
  focusOnSelect: boolean;
}

const defaults: ProfilerSettings = {
  focusOnSelect: false
};

function load(): ProfilerSettings {
  if (typeof localStorage === 'undefined') return defaults;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored);
    return { focusOnSelect: parsed.focusOnSelect ?? defaults.focusOnSelect };
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
    }
  };
}

export const profilerSettings = createProfilerSettingsStore();
