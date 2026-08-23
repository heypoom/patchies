import { describe, expect, it } from 'vitest';

import { getDisplayedCatalogKind } from './catalog-search';

describe('getDisplayedCatalogKind', () => {
  it('prefers a preset-name match over an object fuzzy match', () => {
    expect(
      getDisplayedCatalogKind(
        'objects',
        { categoryCount: 1, hasNameMatch: false },
        { categoryCount: 1, hasNameMatch: true }
      )
    ).toBe('presets');
  });

  it('prefers an object-name match over a preset fuzzy match', () => {
    expect(
      getDisplayedCatalogKind(
        'presets',
        { categoryCount: 1, hasNameMatch: true },
        { categoryCount: 1, hasNameMatch: false }
      )
    ).toBe('objects');
  });

  it('keeps the selected catalog when both catalogs have name matches', () => {
    expect(
      getDisplayedCatalogKind(
        'objects',
        { categoryCount: 1, hasNameMatch: true },
        { categoryCount: 1, hasNameMatch: true }
      )
    ).toBe('objects');
  });
});
