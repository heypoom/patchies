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

  test('allows manual content expansion when not searching', () => {
    expect(
      canManuallyExpandPackContents({
        searchQuery: '',
        hasMatchingItems: false,
        variant: 'row'
      })
    ).toBe(true);
  });

  test('disables manual content expansion when search already reveals matching items', () => {
    expect(
      canManuallyExpandPackContents({
        searchQuery: 'glsl',
        hasMatchingItems: true,
        variant: 'row'
      })
    ).toBe(false);
  });

  test('allows row content expansion when search only matches pack metadata', () => {
    expect(
      canManuallyExpandPackContents({
        searchQuery: 'visual',
        hasMatchingItems: false,
        variant: 'row'
      })
    ).toBe(true);
  });

  test('disables tile content expansion while searching', () => {
    expect(
      canManuallyExpandPackContents({
        searchQuery: 'visual',
        hasMatchingItems: false,
        variant: 'tile'
      })
    ).toBe(false);
  });
});
