import { afterEach, describe, expect, it, vi } from 'vitest';

import { createVfsFileReader } from './file-reader';
import { createVfsApi } from './user-api';

describe('VFS file reader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
    const fetchFile = vi.fn(async () => new Response('main-thread file'));

    vi.stubGlobal('fetch', fetchFile);

    const file = createVfsApi(() => {}).get('https://example.com/file.txt');
    expect(fetchFile).not.toHaveBeenCalled();

    await expect(file.text()).resolves.toBe('main-thread file');
    expect(fetchFile).toHaveBeenCalledWith('https://example.com/file.txt');
  });
});
