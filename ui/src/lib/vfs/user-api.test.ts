import { afterEach, describe, expect, it, vi } from 'vitest';

import { createVfsApi } from './user-api';
import { VirtualFilesystem } from './VirtualFilesystem';
import { UrlProvider } from './providers/UrlProvider';

const unsupportedPaths = [
  'objects://strudel-20/code.js',
  'https://example.com/file.js',
  'http://example.com/file.js',
  'data:text/plain,hello',
  'blob:example',
  '//cdn.example.com/file.js',
  'https://'
];

describe('VFS user API protocol validation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    VirtualFilesystem.resetInstance();
  });

  it('reads a linked HTTP file through its registered VFS path', async () => {
    const fetchFile = vi.fn(async () => new Response('linked file contents'));
    vi.stubGlobal('fetch', fetchFile);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:linked-file');

    const vfs = VirtualFilesystem.getInstance();
    vfs.registerProvider(new UrlProvider());

    const path = await vfs.registerUrl('https://example.com/linked.txt');
    expect(path).toBe('user://linked.txt');

    const api = createVfsApi(() => {});
    await expect(api.get(path).text()).resolves.toBe('linked file contents');

    expect(fetchFile.mock.calls).toEqual([
      ['https://example.com/linked.txt'],
      ['blob:linked-file']
    ]);
  });

  it.each(unsupportedPaths)('rejects %s before fetching', async (path) => {
    const fetchFile = vi.fn();
    vi.stubGlobal('fetch', fetchFile);

    const api = createVfsApi(() => {});
    const error = 'Only user://, patch://, and obj:// protocols are supported.';

    await expect(api.get(path).text()).rejects.toThrow(error);
    await expect(api.getUrl(path)).rejects.toThrow(error);
    await expect(api.list(path)).rejects.toThrow(error);
    await expect(api.search('code', path)).rejects.toThrow(error);

    expect(fetchFile).not.toHaveBeenCalled();
  });
});
