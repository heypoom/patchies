import { describe, expect, it } from 'vitest';
import { filterSettingsOptions, normalizeSettingsOptions } from './options';

describe('settings option helpers', () => {
  it('normalizes string options to labeled options', () => {
    expect(normalizeSettingsOptions(['piano', 'organ'])).toEqual([
      { label: 'piano', value: 'piano' },
      { label: 'organ', value: 'organ' }
    ]);
  });

  it('keeps object options intact', () => {
    const options = [{ label: 'Grand Piano', value: 'acoustic_grand_piano' }];

    expect(normalizeSettingsOptions(options)).toBe(options);
  });

  it('filters options across labels, values, and descriptions', () => {
    const options = normalizeSettingsOptions([
      'acoustic_grand_piano',
      'bright_acoustic_piano',
      'electric_guitar_clean'
    ]);

    expect(filterSettingsOptions(options, 'grand')).toEqual([
      { label: 'acoustic_grand_piano', value: 'acoustic_grand_piano' }
    ]);
    expect(filterSettingsOptions(options, 'guitar clean')).toEqual([
      { label: 'electric_guitar_clean', value: 'electric_guitar_clean' }
    ]);
  });

  it('limits empty-query results', () => {
    const options = normalizeSettingsOptions(['one', 'two', 'three']);

    expect(filterSettingsOptions(options, '', 2)).toEqual([
      { label: 'one', value: 'one' },
      { label: 'two', value: 'two' }
    ]);
  });
});
