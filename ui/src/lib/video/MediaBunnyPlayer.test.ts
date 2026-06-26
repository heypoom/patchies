import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaBunnyPlayer } from './MediaBunnyPlayer';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

function createSample(timestamp: number) {
  const videoFrame = {
    timestamp,
    close: vi.fn()
  };

  return {
    timestamp,
    toVideoFrame: vi.fn(() => videoFrame),
    close: vi.fn()
  };
}

function createThrowingSample(timestamp: number) {
  return {
    timestamp,
    toVideoFrame: vi.fn(() => {
      throw new Error('toVideoFrame failed');
    }),
    close: vi.fn()
  };
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('MediaBunnyPlayer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('ignores stale preview frames from overlapping seeks', async () => {
    const firstSeek = deferred<ReturnType<typeof createSample>>();
    const secondSeek = deferred<ReturnType<typeof createSample>>();
    const samples = new Map<number, Promise<ReturnType<typeof createSample>>>([
      [1, firstSeek.promise],
      [2, secondSeek.promise]
    ]);
    const emittedFrames: number[] = [];
    const firstBitmap = { close: vi.fn(), timestamp: 1 };
    const secondBitmap = { close: vi.fn(), timestamp: 2 };

    vi.stubGlobal('createImageBitmap', bitmapForFrame([firstBitmap, secondBitmap]));

    const player = new MediaBunnyPlayer({
      nodeId: 'video-1',
      onFrame: (_bitmap, timestamp) => emittedFrames.push(timestamp / 1_000_000),
      onMetadata: vi.fn(),
      onEnded: vi.fn(),
      onError: vi.fn()
    });
    const firstSample = createSample(1);
    const secondSample = createSample(2);
    const samplesAtTimestamps = vi.fn((times: Iterable<number>) => samplesForTimes(times, samples));

    Object.assign(player as unknown as { _isLoaded: boolean; sink: unknown }, {
      _isLoaded: true,
      sink: {
        samplesAtTimestamps,
        samples: async function* () {}
      }
    });

    const staleSeek = player.seek(1);
    const latestSeek = player.seek(2);

    firstSeek.resolve(firstSample);
    await nextTick();

    expect(emittedFrames).toEqual([]);

    secondSeek.resolve(secondSample);
    await Promise.all([staleSeek, latestSeek]);

    expect(emittedFrames).toEqual([2]);
    expect(firstSample.close).toHaveBeenCalledTimes(1);
    expect(firstBitmap.close).not.toHaveBeenCalled();
    expect(samplesAtTimestamps).toHaveBeenCalledWith([1]);
    expect(samplesAtTimestamps).toHaveBeenCalledWith([2]);
    expect(player.currentTime).toBe(2);
  });

  it('coalesces intermediate seeks while a preview frame is loading', async () => {
    const firstSeek = deferred<ReturnType<typeof createSample>>();
    const thirdSeek = deferred<ReturnType<typeof createSample>>();
    const samplePromises = new Map<number, Promise<ReturnType<typeof createSample>>>([
      [1, firstSeek.promise],
      [3, thirdSeek.promise]
    ]);
    const emittedFrames: number[] = [];
    const firstBitmap = { close: vi.fn(), timestamp: 1 };
    const thirdBitmap = { close: vi.fn(), timestamp: 3 };
    const samplesAtTimestamps = vi.fn((times: Iterable<number>) =>
      samplesForTimes(times, samplePromises)
    );

    vi.stubGlobal('createImageBitmap', bitmapForFrame([firstBitmap, thirdBitmap]));

    const player = new MediaBunnyPlayer({
      nodeId: 'video-1',
      onFrame: (_bitmap, timestamp) => emittedFrames.push(timestamp / 1_000_000),
      onMetadata: vi.fn(),
      onEnded: vi.fn(),
      onError: vi.fn()
    });

    Object.assign(player as unknown as { _isLoaded: boolean; sink: unknown }, {
      _isLoaded: true,
      sink: {
        samplesAtTimestamps,
        samples: async function* () {}
      }
    });

    const firstSeekPromise = player.seek(1);
    const secondSeekPromise = player.seek(2);
    const thirdSeekPromise = player.seek(3);

    expect(samplesAtTimestamps).toHaveBeenCalledTimes(1);
    expect(samplesAtTimestamps).toHaveBeenLastCalledWith([1]);

    const firstSample = createSample(1);

    firstSeek.resolve(firstSample);
    await nextTick();

    expect(samplesAtTimestamps).toHaveBeenCalledTimes(2);
    expect(samplesAtTimestamps).toHaveBeenLastCalledWith([3]);

    thirdSeek.resolve(createSample(3));
    await Promise.all([firstSeekPromise, secondSeekPromise, thirdSeekPromise]);

    expect(emittedFrames).toEqual([3]);
    expect(firstSample.close).toHaveBeenCalledTimes(1);
    expect(firstBitmap.close).not.toHaveBeenCalled();
    expect(player.currentTime).toBe(3);
  });

  it('reuses cached seek frames without decoding the same frame again', async () => {
    const firstSeek = deferred<ReturnType<typeof createSample>>();
    const samples = new Map<number, Promise<ReturnType<typeof createSample>>>([
      [1, firstSeek.promise]
    ]);
    const emittedFrames: number[] = [];
    const decodedBitmap = { close: vi.fn(), timestamp: 1 };
    const cachedClone = { close: vi.fn(), timestamp: 1 };
    const samplesAtTimestamps = vi.fn((times: Iterable<number>) => samplesForTimes(times, samples));

    vi.stubGlobal('createImageBitmap', bitmapForFrame([decodedBitmap, cachedClone]));

    const player = new MediaBunnyPlayer({
      nodeId: 'video-1',
      onFrame: (_bitmap, timestamp) => emittedFrames.push(timestamp / 1_000_000),
      onMetadata: vi.fn(),
      onEnded: vi.fn(),
      onError: vi.fn()
    });

    Object.assign(player as unknown as { _isLoaded: boolean; _metadata: unknown; sink: unknown }, {
      _isLoaded: true,
      _metadata: { frameRate: 30, duration: 10 },
      sink: {
        samplesAtTimestamps,
        samples: async function* () {}
      }
    });

    const firstSeekPromise = player.seek(1);

    firstSeek.resolve(createSample(1));
    await firstSeekPromise;

    await player.seek(1);

    expect(emittedFrames).toEqual([1, 1]);
    expect(samplesAtTimestamps).toHaveBeenCalledTimes(1);
  });

  it('keeps playback paused while seek messages are still arriving', async () => {
    vi.useFakeTimers();

    const samples = new Map<number, Promise<ReturnType<typeof createSample>>>([
      [1, Promise.resolve(createSample(1))],
      [2, Promise.resolve(createSample(2))]
    ]);
    const samplesAtTimestamps = vi.fn((times: Iterable<number>) => samplesForTimes(times, samples));

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1)
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn((frame: { timestamp: number }) =>
        Promise.resolve({ close: vi.fn(), timestamp: frame.timestamp })
      )
    );

    const player = new MediaBunnyPlayer({
      nodeId: 'video-1',
      onFrame: vi.fn(),
      onMetadata: vi.fn(),
      onEnded: vi.fn(),
      onError: vi.fn()
    });

    Object.assign(player as unknown as { _isLoaded: boolean; _metadata: unknown; sink: unknown }, {
      _isLoaded: true,
      _metadata: { frameRate: 30, duration: 10 },
      sink: {
        samplesAtTimestamps,
        samples: async function* () {}
      }
    });

    player.play();

    await player.seek(1);

    expect(player.paused).toBe(true);

    await vi.advanceTimersByTimeAsync(100);
    await player.seek(2);
    await vi.advanceTimersByTimeAsync(149);

    expect(player.paused).toBe(true);

    await vi.advanceTimersByTimeAsync(1);

    expect(player.paused).toBe(false);
  });

  it('closes a seek sample when converting it to a video frame fails', async () => {
    const sample = createThrowingSample(1);
    const samples = new Map<number, Promise<typeof sample>>([[1, Promise.resolve(sample)]]);

    const player = new MediaBunnyPlayer({
      nodeId: 'video-1',
      onFrame: vi.fn(),
      onMetadata: vi.fn(),
      onEnded: vi.fn(),
      onError: vi.fn()
    });

    Object.assign(player as unknown as { _isLoaded: boolean; sink: unknown }, {
      _isLoaded: true,
      sink: {
        samplesAtTimestamps: (times: Iterable<number>) => samplesForTimes(times, samples),
        samples: async function* () {}
      }
    });

    await player.seek(1);

    expect(sample.close).toHaveBeenCalledTimes(1);
  });

  it('closes a prefetched seek sample when converting it to a video frame fails', async () => {
    const sample = createThrowingSample(1);

    const player = new MediaBunnyPlayer({
      nodeId: 'video-1',
      onFrame: vi.fn(),
      onMetadata: vi.fn(),
      onEnded: vi.fn(),
      onError: vi.fn()
    });

    Object.assign(player as unknown as { _isLoaded: boolean; _metadata: unknown; sink: unknown }, {
      _isLoaded: true,
      _metadata: { frameRate: 30, duration: 10 },
      sink: {
        samplesAtTimestamps: async function* () {},
        samples: async function* () {
          yield sample;
        }
      }
    });

    await player.seek(1);
    await nextTick();

    expect(sample.close).toHaveBeenCalledTimes(1);
  });

  it('does not emit a seek frame after the player is destroyed', async () => {
    const seek = deferred<ReturnType<typeof createSample>>();
    const samples = new Map<number, Promise<ReturnType<typeof createSample>>>([[1, seek.promise]]);
    const onFrame = vi.fn();

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn((frame: { timestamp: number }) =>
        Promise.resolve({ close: vi.fn(), timestamp: frame.timestamp })
      )
    );

    const player = new MediaBunnyPlayer({
      nodeId: 'video-1',
      onFrame,
      onMetadata: vi.fn(),
      onEnded: vi.fn(),
      onError: vi.fn()
    });

    Object.assign(player as unknown as { _isLoaded: boolean; sink: unknown; input: unknown }, {
      _isLoaded: true,
      input: { dispose: vi.fn() },
      sink: {
        samplesAtTimestamps: (times: Iterable<number>) => samplesForTimes(times, samples),
        samples: async function* () {}
      }
    });

    const seekPromise = player.seek(1);

    player.destroy();
    seek.resolve(createSample(1));
    await seekPromise;

    expect(onFrame).not.toHaveBeenCalled();
  });
});

async function* samplesForTimes(
  times: Iterable<number>,
  samples: Map<number, Promise<ReturnType<typeof createSample>>>
) {
  for (const time of times) {
    yield await samples.get(time);
  }
}

function bitmapForFrame(bitmaps: Array<{ close: () => void; timestamp: number }>) {
  return vi.fn((frame: { timestamp: number }) => {
    const bitmap = bitmaps.find((item) => item.timestamp === frame.timestamp);

    if (!bitmap) {
      throw new Error(`No bitmap for frame timestamp ${frame.timestamp}`);
    }

    return Promise.resolve(bitmap);
  });
}
