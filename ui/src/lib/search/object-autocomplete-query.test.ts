import { describe, expect, test } from 'vitest';

import { getObjectAutocompleteQuery } from './object-autocomplete-query';

describe('object autocomplete query', () => {
  test('keeps spaces in preset search queries', () => {
    expect(getObjectAutocompleteQuery('Square Symmetry')).toBe('Square Symmetry');
  });

  test('trims surrounding whitespace without treating inner spaces as arguments', () => {
    expect(getObjectAutocompleteQuery('  Square Symmetry  ')).toBe('Square Symmetry');
  });
});
