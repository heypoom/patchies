import { describe, expect, it } from 'vitest';
import { shouldResetWamGuiSize } from './WamAudioNode';

describe('shouldResetWamGuiSize', () => {
  it('resets the node size when a ready WAM begins loading a different URL', () => {
    expect(
      shouldResetWamGuiSize(
        { state: 'ready', url: 'https://example.com/small/index.js', name: 'Small' },
        { state: 'loading', url: 'https://example.com/large/index.js' }
      )
    ).toBe(true);
  });

  it('preserves saved dimensions for an initial load or a same-URL reload', () => {
    expect(
      shouldResetWamGuiSize(
        { state: 'idle' },
        { state: 'loading', url: 'https://example.com/a.js' }
      )
    ).toBe(false);

    expect(
      shouldResetWamGuiSize(
        { state: 'ready', url: 'https://example.com/a.js', name: 'A' },
        { state: 'loading', url: 'https://example.com/a.js' }
      )
    ).toBe(false);
  });
});
