import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  editorAutocompleteEnabled,
  editorHoverHintsEnabled,
  setEditorAutocompleteEnabled,
  setEditorHoverHintsEnabled
} from './editor.store';

describe('editor settings store', () => {
  beforeEach(() => {
    const items = new Map<string, string>();

    vi.stubGlobal('localStorage', {
      clear: () => items.clear(),
      getItem: (key: string) => items.get(key) ?? null,
      removeItem: (key: string) => items.delete(key),
      setItem: (key: string, value: string) => items.set(key, value)
    });

    localStorage.clear();
    setEditorAutocompleteEnabled(true);
    setEditorHoverHintsEnabled(true);
  });

  it('enables editor autocomplete and hover hints by default', () => {
    expect(get(editorAutocompleteEnabled)).toBe(true);
    expect(get(editorHoverHintsEnabled)).toBe(true);
  });

  it('persists editor autocomplete preference', () => {
    setEditorAutocompleteEnabled(false);

    expect(get(editorAutocompleteEnabled)).toBe(false);
    expect(localStorage.getItem('editor.autocomplete')).toBe('false');
  });

  it('persists editor hover hints preference', () => {
    setEditorHoverHintsEnabled(false);

    expect(get(editorHoverHintsEnabled)).toBe(false);
    expect(localStorage.getItem('editor.hoverHints')).toBe('false');
  });
});
