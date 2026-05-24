import { writable } from 'svelte/store';

const VIM_STORAGE_KEY = 'editor.vim';
const AUTOCOMPLETE_STORAGE_KEY = 'editor.autocomplete';
const HOVER_HINTS_STORAGE_KEY = 'editor.hoverHints';

function readStoredBoolean(key: string, defaultValue: boolean): boolean {
  if (typeof localStorage === 'undefined') return defaultValue;

  const stored = localStorage.getItem(key);
  if (stored === null) return defaultValue;

  return stored === 'true';
}

function persistBoolean(key: string, value: boolean): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, String(value));
  }
}

export const useVimInEditor = writable(readStoredBoolean(VIM_STORAGE_KEY, false));

export const editorAutocompleteEnabled = writable(
  readStoredBoolean(AUTOCOMPLETE_STORAGE_KEY, true)
);

export const editorHoverHintsEnabled = writable(readStoredBoolean(HOVER_HINTS_STORAGE_KEY, true));

export function setEditorAutocompleteEnabled(enabled: boolean): void {
  editorAutocompleteEnabled.set(enabled);

  persistBoolean(AUTOCOMPLETE_STORAGE_KEY, enabled);
}

export function setEditorHoverHintsEnabled(enabled: boolean): void {
  editorHoverHintsEnabled.set(enabled);

  persistBoolean(HOVER_HINTS_STORAGE_KEY, enabled);
}
