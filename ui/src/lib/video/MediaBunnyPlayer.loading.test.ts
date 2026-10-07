import { afterEach, describe, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('mediabunny');
  vi.resetModules();
});

const createPlayer = async () => {
  const { MediaBunnyPlayer } = await import('./MediaBunnyPlayer');
  const onError = vi.fn();
  const player = new MediaBunnyPlayer({
    nodeId: 'video-1',
    onFrame: vi.fn(),
    onMetadata: vi.fn(),
    onEnded: vi.fn(),
    onError
  });

  return { player, onError };
};

describe('on-demand video decoders', () => {
  test('reports decoder download failure through the player error callback', async () => {
    vi.doMock('mediabunny', () => {
      throw new Error('Decoder download failed');
    });

    const { player, onError } = await createPlayer();

    await player.loadUrl('https://example.test/video.mp4');

    expect(onError).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
    expect(player.duration).toBe(0);
    expect(player.paused).toBe(true);
  });

  test('does not initialize a destroyed player after the decoder download finishes', async () => {
    let resolve!: () => void;
    const downloaded = new Promise<void>((done) => (resolve = done));
    const createInput = vi.fn();

    vi.doMock('mediabunny', async () => {
      await downloaded;

      return { Input: createInput };
    });

    const { player, onError } = await createPlayer();
    const loading = player.loadUrl('https://example.test/video.mp4');

    player.destroy();
    resolve();
    await loading;

    expect(createInput).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(player.duration).toBe(0);
  });
});
