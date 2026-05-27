import { describe, expect, it } from 'vitest';

import { CANVAS_DELETE_KEYS } from './keyboard-shortcuts';

describe('canvas keyboard shortcuts', () => {
  it('deletes selected canvas elements with either Backspace or Delete', () => {
    expect(CANVAS_DELETE_KEYS).toEqual(['Backspace', 'Delete']);
  });
});
