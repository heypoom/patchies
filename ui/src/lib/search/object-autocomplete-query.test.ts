import { describe, expect, test } from 'vitest';

import {
  getObjectAutocompleteQuery,
  shouldSuppressObjectAutocomplete
} from './object-autocomplete-query';

describe('object autocomplete query', () => {
  test('keeps spaces in preset search queries', () => {
    expect(getObjectAutocompleteQuery('Square Symmetry')).toBe('Square Symmetry');
  });

  test('trims surrounding whitespace without treating inner spaces as arguments', () => {
    expect(getObjectAutocompleteQuery('  Square Symmetry  ')).toBe('Square Symmetry');
  });

  test('suppresses autocomplete when editing arguments for a known object', () => {
    expect(shouldSuppressObjectAutocomplete('keyboard a', ['keyboard'])).toBe(true);
  });

  test('keeps autocomplete active for multi-word preset names', () => {
    expect(shouldSuppressObjectAutocomplete('Square Symmetry', ['keyboard'])).toBe(false);
  });
});
