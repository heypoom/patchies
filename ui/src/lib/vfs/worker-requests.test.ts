import { beforeEach, describe, expect, it } from 'vitest';

import { VirtualFilesystem } from './VirtualFilesystem';
import { listVfsPaths, resolveVfsText, resolveVfsUrl, searchVfsPaths } from './worker-requests';

describe('worker VFS requests', () => {
  beforeEach(() => {
    VirtualFilesystem.resetInstance();
  });

  it('normalizes and resolves VFS path requests', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const entry = { provider: 'url' as const, filename: 'placeholder' };
    vfs.registerEntry('user://image.png', entry);
    vfs.registerEntry('user://samples/kick.wav', entry);

    expect(await listVfsPaths('.')).toEqual({ paths: ['user://image.png', 'user://samples'] });
    expect(await searchVfsPaths('kick', '.')).toEqual({ paths: ['user://samples/kick.wav'] });
    expect(await listVfsPaths('./image.png')).toEqual({
      error: 'VFS: Path is not a directory: user://image.png'
    });
  });

  it('keeps external URLs external and limits text requests to user paths', async () => {
    expect(await resolveVfsUrl('//cdn.example.com/file.png')).toEqual({
      url: '//cdn.example.com/file.png'
    });
    expect(await resolveVfsText('obj://node/file.txt')).toEqual({
      error: 'Invalid VFS path: "obj://node/file.txt". Only user:// paths are supported.'
    });
  });
});
