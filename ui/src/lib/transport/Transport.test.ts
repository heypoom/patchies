import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function stubLocalStorage(initialValues: Record<string, string> = {}) {
  const items = new Map(Object.entries(initialValues));

  vi.stubGlobal('localStorage', {
    clear: () => items.clear(),
    getItem: (key: string) => items.get(key) ?? null,
    removeItem: (key: string) => items.delete(key),
    setItem: (key: string, value: string) => items.set(key, value)
  });
}

describe('Transport', () => {
  beforeEach(() => {
    vi.resetModules();
    stubLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes bpm and time signature from persisted transport state', async () => {
    stubLocalStorage({
      'patchies:transport': JSON.stringify({
        bpm: 96,
        timeSignature: [7, 8]
      })
    });

    const { Transport } = await import('./Transport');

    expect(Transport.bpm).toBe(96);
    expect(Transport.beatsPerBar).toBe(7);
    expect(Transport.denominator).toBe(8);
  });

  it('keeps the clock source in sync when transport store settings change', async () => {
    const { Transport } = await import('./Transport');
    const { transportStore } = await import('../../stores/transport.store');

    transportStore.setBpm(140);
    transportStore.setTimeSignature(5, 4);

    expect(Transport.bpm).toBe(140);
    expect(Transport.beatsPerBar).toBe(5);
    expect(Transport.denominator).toBe(4);
  });

  it('stops syncing transport store settings after destroy', async () => {
    const { Transport } = await import('./Transport');
    const { transportStore } = await import('../../stores/transport.store');

    Transport.destroy();
    transportStore.setBpm(150);
    transportStore.setTimeSignature(3, 4);

    expect(Transport.bpm).not.toBe(150);
    expect(Transport.beatsPerBar).not.toBe(3);
  });
});
