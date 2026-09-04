import { describe, expect, it, vi } from 'vitest';

import { clearVfsCache, createCachedResolver } from './cache';

describe('GLSL include cache', () => {
  it('does not let an invalidated inflight VFS read repopulate the cache', async () => {
    let resolveFirstRead: ((content: string) => void) | undefined;
    const resolveVfs = vi
      .fn<(path: string) => Promise<string>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstRead = resolve;
          })
      )
      .mockResolvedValue('new source');
    const resolver = createCachedResolver({
      resolveNpm: vi.fn(async () => ''),
      resolveVfs,
      resolveUrl: vi.fn(async () => '')
    });

    const staleRead = resolver.resolveVfs('patch://utility.glsl');
    clearVfsCache(resolver, 'patch://utility.glsl');
    const freshRead = resolver.resolveVfs('patch://utility.glsl');

    resolveFirstRead?.('old source');

    await expect(staleRead).resolves.toBe('old source');
    await expect(freshRead).resolves.toBe('new source');
    await expect(resolver.resolveVfs('patch://utility.glsl')).resolves.toBe('new source');
    expect(resolveVfs).toHaveBeenCalledTimes(2);
  });
});
