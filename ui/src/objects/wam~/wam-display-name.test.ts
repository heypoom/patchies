import { describe, expect, it } from 'vitest';
import { getWamDisplayName } from './WamAudioNode';

describe('getWamDisplayName', () => {
  it('prefers the WAM module descriptor name', () => {
    expect(
      getWamDisplayName(
        'https://example.com/unknown/index.js',
        { name: 'A Very Long Descriptor Name' },
        { name: 'Instance name' }
      )
    ).toBe('A Very Long Descrip…');
  });

  it('falls back to the instance descriptor and then the URL', () => {
    expect(
      getWamDisplayName('https://example.com/unknown/index.js', undefined, { name: 'Bass' })
    ).toBe('Bass');

    expect(getWamDisplayName('https://example.com/plugins/BigMuff/index.js')).toBe('Big Muff');
  });
});
