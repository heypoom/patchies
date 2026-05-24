import { writable } from 'svelte/store';
import { match } from 'ts-pattern';

export type EditorLayoutPreference = 'inline' | 'overlay' | 'sidebar';

const DEFAULT_EDITOR_LAYOUT_KEY = 'editor.defaultLayout';
const OVERLAY_TRANSPARENCY_KEY = 'editor.overlayTransparency';

const DEFAULT_EDITOR_LAYOUT: EditorLayoutPreference = 'inline';
const DEFAULT_OVERLAY_TRANSPARENCY = 0.72;

export const defaultEditorLayout = writable<EditorLayoutPreference>(readDefaultEditorLayout());
export const overlayEditorTransparency = writable<number>(readOverlayTransparency());

function readDefaultEditorLayout(): EditorLayoutPreference {
  if (typeof localStorage === 'undefined') return DEFAULT_EDITOR_LAYOUT;

  return match(localStorage.getItem(DEFAULT_EDITOR_LAYOUT_KEY))
    .with('inline', () => 'inline' as const)
    .with('overlay', () => 'overlay' as const)
    .with('sidebar', () => 'sidebar' as const)
    .otherwise(() => DEFAULT_EDITOR_LAYOUT);
}

function clampTransparency(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_OVERLAY_TRANSPARENCY;

  return Math.min(1, Math.max(0, value));
}

function readOverlayTransparency(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_OVERLAY_TRANSPARENCY;

  const stored = localStorage.getItem(OVERLAY_TRANSPARENCY_KEY);
  if (stored === null) return DEFAULT_OVERLAY_TRANSPARENCY;

  return clampTransparency(Number(stored));
}

export function setDefaultEditorLayout(value: EditorLayoutPreference): void {
  defaultEditorLayout.set(value);

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DEFAULT_EDITOR_LAYOUT_KEY, value);
  }
}

export function setOverlayEditorTransparency(value: number): void {
  const next = clampTransparency(value);

  overlayEditorTransparency.set(next);

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(OVERLAY_TRANSPARENCY_KEY, String(next));
  }
}
