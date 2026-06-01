import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';

import {
  activeDetachedSheetNodeId,
  closeDetachedSheet,
  isDetachedSheet,
  openDetachedSheet
} from './detached-sheet.store';

describe('detached sheet store', () => {
  afterEach(() => {
    closeDetachedSheet();
  });

  it('tracks the active detached sheet node', () => {
    openDetachedSheet('sheet-1');

    expect(get(activeDetachedSheetNodeId)).toBe('sheet-1');
    expect(isDetachedSheet('sheet-1')).toBe(true);
    expect(isDetachedSheet('sheet-2')).toBe(false);
  });

  it('clears the active detached sheet node', () => {
    openDetachedSheet('sheet-1');
    closeDetachedSheet();

    expect(get(activeDetachedSheetNodeId)).toBeNull();
    expect(isDetachedSheet('sheet-1')).toBe(false);
  });
});
