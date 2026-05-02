import { describe, expect, test } from 'vitest';

import { canTogglePack, canManuallyExpandPackContents } from './pack-card-behavior';

describe('pack card behavior', () => {
  test('allows the card body to toggle available unlocked packs', () => {
    expect(canTogglePack({ locked: false, unavailable: false })).toBe(true);
  });

  test('blocks card-body toggles for locked or unavailable packs', () => {
    expect(canTogglePack({ locked: true, unavailable: false })).toBe(false);
    expect(canTogglePack({ locked: false, unavailable: true })).toBe(false);
  });

  test('disables manual content expansion while searching', () => {
    expect(canManuallyExpandPackContents({ searchQuery: '' })).toBe(true);
    expect(canManuallyExpandPackContents({ searchQuery: 'glsl' })).toBe(false);
  });
});
