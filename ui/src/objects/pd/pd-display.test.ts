import { describe, expect, it } from 'vitest';
import { getPdDisplayFilename } from './pd-display';

describe('getPdDisplayFilename', () => {
  it('uses the runtime path when a loaded patch is not yet reflected in node data', () => {
    expect(
      getPdDisplayFilename(
        { sourceCode: null, sourceUrl: '', vfsPath: '' },
        { state: 'ready', path: 'user://kijjaz-test.pd' }
      )
    ).toBe('kijjaz-test.pd');
  });

  it('recognizes runtime-loaded inline code before node data updates', () => {
    expect(
      getPdDisplayFilename(
        { sourceCode: null, sourceUrl: '', vfsPath: '' },
        { state: 'ready', path: 'inline Pd code' }
      )
    ).toBe('Inline patch');
  });

  it('keeps the source filename after its code is edited', () => {
    expect(
      getPdDisplayFilename(
        {
          sourceCode: '#N canvas 0 0 200 200 10;',
          sourceUrl: '',
          vfsPath: 'patch://pd/kijjaz-test.pd'
        },
        { state: 'ready', path: 'inline Pd code' }
      )
    ).toBe('kijjaz-test.pd');
  });
});
