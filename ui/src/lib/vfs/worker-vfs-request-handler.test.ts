import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VirtualFilesystem } from './VirtualFilesystem';
import { EmbeddedProvider } from './providers/EmbeddedProvider';
import {
  listVfsEntries,
  revokeWorkerVfsObjectUrls,
  resolveVfsText,
  resolveVfsUrl,
  searchVfsEntries
} from './worker-vfs-request-handler';

describe('worker VFS requests', () => {
  beforeEach(() => {
    VirtualFilesystem.resetInstance();
    VirtualFilesystem.getInstance().registerProvider(new EmbeddedProvider());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes and resolves VFS path requests', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const entry = { provider: 'url' as const, filename: 'placeholder' };

    vfs.registerEntry('user://image.png', entry);
    vfs.registerEntry('user://samples/kick.wav', entry);

    expect(await listVfsEntries('.')).toEqual({
      entries: [
        { path: 'user://image.png', name: 'image.png', kind: 'file' },
        { path: 'user://samples', name: 'samples', kind: 'directory' }
      ]
    });

    expect(await searchVfsEntries('kick', '.')).toEqual({
      entries: [{ path: 'user://samples/kick.wav', name: 'kick.wav', kind: 'file' }]
    });

    expect(await listVfsEntries('./image.png')).toEqual({
      error: 'VFS: Path is not a directory: user://image.png'
    });
  });

  it('keeps external URLs external and limits text requests to include namespaces', async () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.createEmbeddedFile(
      'patch://world.glsl',
      'float circle(vec2 point, float radius) { return length(point) - radius; }'
    );

    expect(await resolveVfsUrl('node-1', '//cdn.example.com/file.png')).toEqual({
      url: '//cdn.example.com/file.png'
    });

    expect(await resolveVfsText('patch://world.glsl')).toEqual({
      text: 'float circle(vec2 point, float radius) { return length(point) - radius; }'
    });

    expect(await resolveVfsText('obj://node/file.txt')).toEqual({
      error:
        'Invalid VFS path: "obj://node/file.txt". Only patch:// and user:// paths are supported.'
    });
  });

  it('revokes Blob URLs when a worker node is destroyed', async () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.registerProvider({ type: 'url', resolve: async () => new Blob(['file']) });
    vfs.registerEntry('user://image.png', { provider: 'url', filename: 'image.png' });

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:node-1-image');

    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    await resolveVfsUrl('node-1', './image.png');

    revokeWorkerVfsObjectUrls('node-1');

    expect(revoke).toHaveBeenCalledWith('blob:node-1-image');
  });
});
