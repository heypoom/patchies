import { writable } from 'svelte/store';

const CULL_OBJECTS_STORAGE_KEY = 'debug.cullObjects';

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof localStorage === 'undefined') return fallback;

  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;

    return stored === 'true';
  } catch {
    return fallback;
  }
}

function persistBoolean(key: string, value: boolean): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Restricted-storage environments may expose localStorage but throw on access.
  }
}

export const cullObjects = writable(readStoredBoolean(CULL_OBJECTS_STORAGE_KEY, false));

export function setCullObjects(enabled: boolean): void {
  cullObjects.set(enabled);
  persistBoolean(CULL_OBJECTS_STORAGE_KEY, enabled);
}
