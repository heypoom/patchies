import { afterEach, describe, expect, it, vi } from 'vitest';

import { createVfsFileReader } from './file-reader';
import { createVfsApi } from './user-api';
import { VirtualFilesystem } from './VirtualFilesystem';

describe('VFS file reader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    VirtualFilesystem.resetInstance();
  });

  it('reads each supported response body representation', async () => {
    const getUrl = vi.fn(async () => 'blob:file');
    const fetchFile = vi.fn(async () => new Response('{"answer":42}'));

    vi.stubGlobal('fetch', fetchFile);

    const file = createVfsFileReader('./file.json', getUrl);

    await expect(file.json<{ answer: number }>()).resolves.toEqual({ answer: 42 });
    await expect(file.text()).resolves.toBe('{"answer":42}');
    await expect(file.blob()).resolves.toBeInstanceOf(Blob);

    const buffer = await file.arrayBuffer();
    expect(new TextDecoder().decode(buffer)).toBe('{"answer":42}');

    expect(getUrl).toHaveBeenCalledTimes(4);
    expect(getUrl).toHaveBeenCalledWith('./file.json');
    expect(fetchFile).toHaveBeenCalledTimes(4);
    expect(fetchFile).toHaveBeenCalledWith('blob:file');
  });

  it('exposes a lazy reader through the main-thread VFS API', async () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.registerProvider({ type: 'url', resolve: async () => new Blob(['main-thread file']) });
    vfs.registerEntry('user://code.js', { provider: 'url', filename: 'code.js' });

    const fetchFile = vi.fn(async () => new Response('main-thread file'));

    vi.stubGlobal('fetch', fetchFile);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:file');

    const file = createVfsApi(() => {}).get('./code.js');
    expect(fetchFile).not.toHaveBeenCalled();

    await expect(file.text()).resolves.toBe('main-thread file');
    expect(fetchFile).toHaveBeenCalledWith('blob:file');
  });
});
