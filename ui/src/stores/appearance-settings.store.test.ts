import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  edgeOpacity,
  nodeOpacity,
  setEdgeOpacity,
  setNodeOpacity
} from './appearance-settings.store';

describe('appearance settings store', () => {
  beforeEach(() => {
    const items = new Map<string, string>();

    vi.stubGlobal('localStorage', {
      clear: () => items.clear(),
      getItem: (key: string) => items.get(key) ?? null,
      removeItem: (key: string) => items.delete(key),
      setItem: (key: string, value: string) => items.set(key, value)
    });

    localStorage.clear();
    setNodeOpacity(100);
    setEdgeOpacity(100);
  });

  it('persists node and edge opacity separately', () => {
    setNodeOpacity(65);
    setEdgeOpacity(40);

    expect(get(nodeOpacity)).toBe(65);
    expect(get(edgeOpacity)).toBe(40);
    expect(localStorage.getItem('appearance.nodeOpacity')).toBe('65');
    expect(localStorage.getItem('appearance.edgeOpacity')).toBe('40');
  });

  it('clamps opacity to the valid percentage range', () => {
    setNodeOpacity(-10);
    setEdgeOpacity(150);

    expect(get(nodeOpacity)).toBe(0);
    expect(get(edgeOpacity)).toBe(100);
  });
});
