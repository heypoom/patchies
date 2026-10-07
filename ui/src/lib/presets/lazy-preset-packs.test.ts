import { describe, expect, test, vi } from 'vitest';
import { createPresetPackLoader } from './lazy-preset-packs';
import type { LegacyPresetsRecord } from './types';

const presets: LegacyPresetsRecord = {
  'archive.beat': { type: 'bytebeat~', data: { expr: 't & 255' } }
};

describe('optional preset payloads', () => {
  test('publishes enabled payloads only when requested', async () => {
    const publish = vi.fn();
    const load = createPresetPackLoader({
      loaders: { archive: async () => presets },
      publish
    });

    await load(['starters']);

    expect(publish).not.toHaveBeenCalled();

    await load(['starters', 'archive']);

    expect(publish).toHaveBeenCalledExactlyOnceWith(presets);
  });

  test('shares concurrent demand and publishes a payload once', async () => {
    let resolve!: (presets: LegacyPresetsRecord) => void;
    const payload = new Promise<LegacyPresetsRecord>((done) => (resolve = done));
    const publish = vi.fn();
    const load = createPresetPackLoader({
      loaders: { archive: () => payload },
      publish
    });

    const first = load(['archive']);
    const second = load(['archive']);

    expect(publish).not.toHaveBeenCalled();

    resolve(presets);
    await Promise.all([first, second]);
    await load(['archive']);

    expect(publish).toHaveBeenCalledExactlyOnceWith(presets);
  });

  test('can retry after a failed download without publishing incomplete data', async () => {
    const publish = vi.fn();
    let unavailable = true;
    const load = createPresetPackLoader({
      loaders: {
        archive: async () => {
          if (unavailable) throw new Error('Download failed');

          return presets;
        }
      },
      publish
    });

    await expect(load(['archive'])).rejects.toThrow('Download failed');

    expect(publish).not.toHaveBeenCalled();

    unavailable = false;
    await load(['archive']);

    expect(publish).toHaveBeenCalledExactlyOnceWith(presets);
  });
});
