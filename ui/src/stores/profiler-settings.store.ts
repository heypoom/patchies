import { writable } from 'svelte/store';
import { ProfilerCoordinator, type ProfilerConfig } from '$lib/profiler/ProfilerCoordinator';

const STORAGE_KEY = 'patchies:profiler-settings';

export type DisplayStat = 'avg' | 'max' | 'p95' | 'last' | 'calls/s';

export const SAMPLE_WINDOW_OPTIONS = [2.5, 5, 10] as const;
export type SampleWindow = (typeof SAMPLE_WINDOW_OPTIONS)[number];

export const FLUSH_INTERVAL_OPTIONS = [250, 500, 1000] as const;
export type FlushInterval = (typeof FLUSH_INTERVAL_OPTIONS)[number];

export const HOT_THRESHOLD_OPTIONS = [1, 2, 5, 10] as const;
export type HotThreshold = (typeof HOT_THRESHOLD_OPTIONS)[number];

interface ProfilerSettings {
  focusOnSelect: boolean;
  displayStat: DisplayStat;
  sampleWindowSec: SampleWindow;
  flushIntervalMs: FlushInterval;
  hotThresholdMs: HotThreshold;
}

const DISPLAY_STATS: DisplayStat[] = ['avg', 'max', 'p95', 'last', 'calls/s'];

const defaults: ProfilerSettings = {
  focusOnSelect: false,
  displayStat: 'avg',
  sampleWindowSec: 10,
  flushIntervalMs: 500,
  hotThresholdMs: 2
};

/** Convert sample window (seconds) to ring buffer capacity at 120fps */
function windowToCapacity(sec: number): number {
  return Math.round(sec * 120);
}

function includes<T>(arr: readonly T[], v: unknown): v is T {
  return (arr as readonly unknown[]).includes(v);
}

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
        : defaults.displayStat,
      sampleWindowSec: includes(SAMPLE_WINDOW_OPTIONS, parsed.sampleWindowSec)
        ? parsed.sampleWindowSec
        : defaults.sampleWindowSec,
      flushIntervalMs: includes(FLUSH_INTERVAL_OPTIONS, parsed.flushIntervalMs)
        ? parsed.flushIntervalMs
        : defaults.flushIntervalMs,
      hotThresholdMs: includes(HOT_THRESHOLD_OPTIONS, parsed.hotThresholdMs)
        ? parsed.hotThresholdMs
        : defaults.hotThresholdMs
    };
  } catch {
    return defaults;
  }
}

/** Sync profiler coordinator config from settings */
function applyConfig(s: ProfilerSettings): void {
  const config: Partial<ProfilerConfig> = {
    sampleCapacity: windowToCapacity(s.sampleWindowSec),
    flushIntervalMs: s.flushIntervalMs,
    hotThresholdMs: s.hotThresholdMs
  };

  ProfilerCoordinator.getInstance().setConfig(config);
}

function createProfilerSettingsStore() {
  const initial = load();
  const { subscribe, update } = writable<ProfilerSettings>(initial);

  // Apply initial config
  if (typeof window !== 'undefined') {
    applyConfig(initial);
  }

  subscribe((state) => {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}

    applyConfig(state);
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
    },
    setSampleWindow(v: SampleWindow) {
      update((s) => ({ ...s, sampleWindowSec: v }));
    },
    setFlushInterval(v: FlushInterval) {
      update((s) => ({ ...s, flushIntervalMs: v }));
    },
    setHotThreshold(v: HotThreshold) {
      update((s) => ({ ...s, hotThresholdMs: v }));
    }
  };
}

export const profilerSettings = createProfilerSettingsStore();
