import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  editorAutocompleteEnabled,
  editorFontFamily,
  editorFontSize,
  editorFullscreenFontSize,
  editorFullscreenTextBackgroundOpacity,
  editorHoverHintsEnabled,
  setEditorAutocompleteEnabled,
  setEditorFontFamily,
  setEditorFontSize,
  setEditorFullscreenFontSize,
  setEditorFullscreenTextBackgroundOpacity,
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
    setEditorFontSize(12);
    setEditorFullscreenFontSize(28);
    setEditorFullscreenTextBackgroundOpacity(70);
    setEditorFontFamily('mono');
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

  it('persists editor font size preferences separately for normal and fullscreen layouts', () => {
    setEditorFontSize(15);
    setEditorFullscreenFontSize(32);

    expect(get(editorFontSize)).toBe(15);
    expect(get(editorFullscreenFontSize)).toBe(32);
    expect(localStorage.getItem('editor.fontSize')).toBe('15');
    expect(localStorage.getItem('editor.fullscreenFontSize')).toBe('32');
  });

  it('clamps editor font sizes to readable ranges', () => {
    setEditorFontSize(4);
    setEditorFullscreenFontSize(200);

    expect(get(editorFontSize)).toBe(10);
    expect(get(editorFullscreenFontSize)).toBe(48);
  });

  it('persists fullscreen text background opacity from transparent to opaque', () => {
    setEditorFullscreenTextBackgroundOpacity(65);
    expect(get(editorFullscreenTextBackgroundOpacity)).toBe(65);
    expect(localStorage.getItem('editor.fullscreenTextBackgroundOpacity')).toBe('65');

    setEditorFullscreenTextBackgroundOpacity(200);
    expect(get(editorFullscreenTextBackgroundOpacity)).toBe(100);

    setEditorFullscreenTextBackgroundOpacity(-10);
    expect(get(editorFullscreenTextBackgroundOpacity)).toBe(0);
  });

  it('defaults fullscreen text background opacity to 70%', async () => {
    localStorage.clear();
    vi.resetModules();
    const { editorFullscreenTextBackgroundOpacity } = await import('./editor.store');

    expect(get(editorFullscreenTextBackgroundOpacity)).toBe(70);
  });

  it('persists a custom editor font family stack', () => {
    setEditorFontFamily('Berkeley Mono, ui-monospace, monospace');

    expect(get(editorFontFamily)).toBe('Berkeley Mono, ui-monospace, monospace');
    expect(localStorage.getItem('editor.fontFamily')).toBe(
      'Berkeley Mono, ui-monospace, monospace'
    );
  });

  it('loads a custom editor font family stack from storage', async () => {
    localStorage.setItem('editor.fontFamily', 'Iosevka, ui-monospace, monospace');

    vi.resetModules();
    const { editorFontFamily } = await import('./editor.store');

    expect(get(editorFontFamily)).toBe('Iosevka, ui-monospace, monospace');
  });
});
