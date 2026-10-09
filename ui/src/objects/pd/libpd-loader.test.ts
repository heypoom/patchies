import { describe, expect, it, vi } from 'vitest';
import { loadLibPd } from './libpd-loader';

describe('loadLibPd', () => {
  it('creates a Pd runtime without reading the worklet URL before initialization', async () => {
    const library = await loadLibPd();
    const addModule = vi.fn().mockRejectedValue(new Error('stop after worklet initialization'));
    const audioContext = { audioWorklet: { addModule } } as unknown as AudioContext;

    await expect(
      library.createPd({
        audioContext,
        packages: ['cyclone', 'else'],
        files: { 'main.pd': '#N canvas 0 0 100 100 10;' },
        entry: 'main.pd',
        workletUrl: library.workletUrl
      })
    ).rejects.toThrow('stop after worklet initialization');

    expect(addModule).toHaveBeenCalledExactlyOnceWith(library.workletUrl);
  });
});
