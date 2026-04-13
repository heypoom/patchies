import { writable } from 'svelte/store';

export const isBackgroundOutputCanvasEnabled = writable(false);
export const hasSomeAudioNode = writable(false);

/** Snap grid size in pixels. 0 = no snapping. Persisted to localStorage. */
export const SNAP_GRID_OPTIONS = [0, 1, 5, 10, 20] as const;
export type SnapGridSize = (typeof SNAP_GRID_OPTIONS)[number];

const SNAP_GRID_STORAGE_KEY = 'patchies:snapGridSize';

function loadSnapGridSize(): SnapGridSize {
  if (typeof localStorage === 'undefined') return 5;
  const stored = localStorage.getItem(SNAP_GRID_STORAGE_KEY);
  if (stored !== null) {
    const parsed = Number(stored);
    if (SNAP_GRID_OPTIONS.includes(parsed as SnapGridSize)) return parsed as SnapGridSize;
  }
  return 5;
}

export const snapGridSize = writable<SnapGridSize>(loadSnapGridSize());

snapGridSize.subscribe((size) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SNAP_GRID_STORAGE_KEY, String(size));
  }
});
