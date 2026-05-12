import { describe, expect, it } from 'vitest';

import { FloatTextureSharedVersionTracker } from './shared-version-tracker';

describe('FloatTextureSharedVersionTracker', () => {
  it('allows the first shared buffer version and skips repeats', () => {
    const tracker = new FloatTextureSharedVersionTracker();

    const source = {
      buffer: new SharedArrayBuffer(4 * Float32Array.BYTES_PER_ELEMENT),
      width: 1,
      height: 1,
      type: 'rgba' as const,
      version: 1
    };

    expect(tracker.shouldUpload(source)).toBe(true);
    expect(tracker.shouldUpload(source)).toBe(false);
  });

  it('allows the same shared buffer when the version changes', () => {
    const tracker = new FloatTextureSharedVersionTracker();
    const buffer = new SharedArrayBuffer(4 * Float32Array.BYTES_PER_ELEMENT);

    expect(
      tracker.shouldUpload({
        buffer,
        width: 1,
        height: 1,
        type: 'rgba',
        version: 1
      })
    ).toBe(true);

    expect(
      tracker.shouldUpload({
        buffer,
        width: 1,
        height: 1,
        type: 'rgba',
        version: 2
      })
    ).toBe(true);
  });

  it('allows different shared buffers with the same version', () => {
    const tracker = new FloatTextureSharedVersionTracker();

    expect(
      tracker.shouldUpload({
        buffer: new SharedArrayBuffer(4 * Float32Array.BYTES_PER_ELEMENT),
        width: 1,
        height: 1,
        type: 'rgba',
        version: 1
      })
    ).toBe(true);

    expect(
      tracker.shouldUpload({
        buffer: new SharedArrayBuffer(4 * Float32Array.BYTES_PER_ELEMENT),
        width: 1,
        height: 1,
        type: 'rgba',
        version: 1
      })
    ).toBe(true);
  });

  it('skips repeated wrapped shared channel versions', () => {
    const tracker = new FloatTextureSharedVersionTracker();
    const channels = new SharedArrayBuffer(4 * Float32Array.BYTES_PER_ELEMENT);
    const source = {
      type: 'wrapped' as const,
      channels,
      width: 2,
      version: 1
    };

    expect(tracker.shouldUpload(source)).toBe(true);
    expect(tracker.shouldUpload(source)).toBe(false);
    expect(tracker.shouldUpload({ ...source, version: 2 })).toBe(true);
  });

  it('skips repeated square shared channel group versions', () => {
    const tracker = new FloatTextureSharedVersionTracker();
    const x = new SharedArrayBuffer(4 * Float32Array.BYTES_PER_ELEMENT);
    const y = new SharedArrayBuffer(4 * Float32Array.BYTES_PER_ELEMENT);
    const source = {
      type: 'square' as const,
      channels: [x, y],
      version: 1
    };

    expect(tracker.shouldUpload(source)).toBe(true);
    expect(tracker.shouldUpload(source)).toBe(false);
    expect(tracker.shouldUpload({ ...source, channels: [x, new SharedArrayBuffer(4)] })).toBe(true);
  });
});
