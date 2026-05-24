import { writable } from 'svelte/store';

const VIM_STORAGE_KEY = 'editor.vim';
const AUTOCOMPLETE_STORAGE_KEY = 'editor.autocomplete';
const HOVER_HINTS_STORAGE_KEY = 'editor.hoverHints';
const FONT_SIZE_STORAGE_KEY = 'editor.fontSize';
const FULLSCREEN_FONT_SIZE_STORAGE_KEY = 'editor.fullscreenFontSize';
const FONT_FAMILY_STORAGE_KEY = 'editor.fontFamily';

const DEFAULT_FONT_SIZE = 12;
const DEFAULT_FULLSCREEN_FONT_SIZE = 28;
const DEFAULT_FONT_FAMILY = 'var(--font-mono)';

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

function clampFontSize(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;

  return Math.min(max, Math.max(min, Math.round(value)));
}

function readStoredNumber(key: string, defaultValue: number, min: number, max: number): number {
  if (typeof localStorage === 'undefined') return defaultValue;

  const stored = localStorage.getItem(key);
  if (stored === null) return defaultValue;

  return clampFontSize(Number(stored), min, max, defaultValue);
}

function persistNumber(key: string, value: number): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, String(value));
  }
}

function readFontFamily(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_FONT_FAMILY;

  const stored = localStorage.getItem(FONT_FAMILY_STORAGE_KEY)?.trim();

  return stored || DEFAULT_FONT_FAMILY;
}

export const useVimInEditor = writable(readStoredBoolean(VIM_STORAGE_KEY, false));

export const editorAutocompleteEnabled = writable(
  readStoredBoolean(AUTOCOMPLETE_STORAGE_KEY, true)
);

export const editorHoverHintsEnabled = writable(readStoredBoolean(HOVER_HINTS_STORAGE_KEY, true));

export const editorFontSize = writable(
  readStoredNumber(FONT_SIZE_STORAGE_KEY, DEFAULT_FONT_SIZE, 10, 24)
);

export const editorFullscreenFontSize = writable(
  readStoredNumber(FULLSCREEN_FONT_SIZE_STORAGE_KEY, DEFAULT_FULLSCREEN_FONT_SIZE, 14, 48)
);

export const editorFontFamily = writable(readFontFamily());

export function setEditorAutocompleteEnabled(enabled: boolean): void {
  editorAutocompleteEnabled.set(enabled);
  persistBoolean(AUTOCOMPLETE_STORAGE_KEY, enabled);
}

export function setEditorHoverHintsEnabled(enabled: boolean): void {
  editorHoverHintsEnabled.set(enabled);
  persistBoolean(HOVER_HINTS_STORAGE_KEY, enabled);
}

export function setEditorFontSize(fontSize: number): void {
  const next = clampFontSize(fontSize, 10, 24, DEFAULT_FONT_SIZE);

  editorFontSize.set(next);
  persistNumber(FONT_SIZE_STORAGE_KEY, next);
}

export function setEditorFullscreenFontSize(fontSize: number): void {
  const next = clampFontSize(fontSize, 14, 48, DEFAULT_FULLSCREEN_FONT_SIZE);

  editorFullscreenFontSize.set(next);
  persistNumber(FULLSCREEN_FONT_SIZE_STORAGE_KEY, next);
}

export function setEditorFontFamily(fontFamily: string): void {
  const next = fontFamily.trim() || DEFAULT_FONT_FAMILY;

  editorFontFamily.set(next);

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(FONT_FAMILY_STORAGE_KEY, next);
  }
}
