import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  defaultEditorLayout,
  getEditorOpenLayout,
  overlayEditorTransparency,
  setDefaultEditorLayout,
  setOverlayEditorTransparency
} from './editor-layout-settings.store';

describe('editor layout settings store', () => {
  beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => items.clear(),
      getItem: (key: string) => items.get(key) ?? null,
      removeItem: (key: string) => items.delete(key),
      setItem: (key: string, value: string) => items.set(key, value)
    });

    localStorage.clear();
    setDefaultEditorLayout('inline');
    setOverlayEditorTransparency(0.72);
  });

  it('persists the default editor layout preference', () => {
    setDefaultEditorLayout('overlay');

    expect(get(defaultEditorLayout)).toBe('overlay');
    expect(localStorage.getItem('editor.defaultLayout')).toBe('overlay');
  });

  it('clamps and persists overlay transparency', () => {
    setOverlayEditorTransparency(2);

    expect(get(overlayEditorTransparency)).toBe(1);
    expect(localStorage.getItem('editor.overlayTransparency')).toBe('1');

    setOverlayEditorTransparency(-1);

    expect(get(overlayEditorTransparency)).toBe(0);
    expect(localStorage.getItem('editor.overlayTransparency')).toBe('0');
  });

  it('resolves shift-click alternate editor layouts', () => {
    expect(getEditorOpenLayout('inline', false)).toBe('inline');
    expect(getEditorOpenLayout('inline', true)).toBe('overlay');
    expect(getEditorOpenLayout('overlay', false)).toBe('overlay');
    expect(getEditorOpenLayout('overlay', true)).toBe('inline');
    expect(getEditorOpenLayout('sidebar', true)).toBe('overlay');
  });
});
