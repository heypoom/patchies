import { beforeEach, describe, expect, it } from 'vitest';

import { VirtualFilesystem } from './VirtualFilesystem';
import { isExternalUrl, normalizeUserVfsPath } from './user-api-paths';

describe('VFS user API paths', () => {
  beforeEach(() => {
    VirtualFilesystem.resetInstance();
  });

  it('defaults relative paths to the user namespace', () => {
    expect(normalizeUserVfsPath('.')).toBe('user://');
    expect(normalizeUserVfsPath('./images/cat.png')).toBe('user://images/cat.png');
    expect(normalizeUserVfsPath('images/cat.png')).toBe('user://images/cat.png');
    expect(normalizeUserVfsPath('obj://node/file.txt')).toBe('obj://node/file.txt');
  });

  it('recognizes external URLs, including protocol-relative URLs', () => {
    expect(isExternalUrl('https://example.com/file.png')).toBe(true);
    expect(isExternalUrl('//cdn.example.com/file.png')).toBe(true);
    expect(isExternalUrl('user://file.png')).toBe(false);
  });

  it('distinguishes an empty directory from a missing directory', async () => {
    const vfs = VirtualFilesystem.getInstance();

    vfs.createFolder('user://', 'empty');
    await expect(vfs.listChildren('user://empty')).resolves.toEqual([]);

    await expect(vfs.listChildrenPage('user://empty')).resolves.toMatchObject({
      entries: [],
      truncated: false
    });

    await expect(vfs.listChildren('user://missing')).rejects.toThrow(
      'VFS: Directory not found: user://missing'
    );

    await expect(vfs.listChildrenPage('user://missing')).rejects.toThrow(
      'VFS: Directory not found: user://missing'
    );
  });

  it('lists direct children and searches descendants', async () => {
    const vfs = VirtualFilesystem.getInstance();

    const entry = { provider: 'url' as const, filename: 'placeholder' };
    vfs.registerEntry('user://image.png', entry);
    vfs.registerEntry('user://samples/kick.wav', entry);
    vfs.registerEntry('user://samples/snares/snare.wav', entry);

    expect(await vfs.listChildren('user://')).toEqual([
      { path: 'user://image.png', name: 'image.png', kind: 'file' },
      { path: 'user://samples', name: 'samples', kind: 'directory' }
    ]);

    expect(await vfs.listChildren('user://samples')).toEqual([
      { path: 'user://samples/kick.wav', name: 'kick.wav', kind: 'file' },
      { path: 'user://samples/snares', name: 'snares', kind: 'directory' }
    ]);

    expect(await vfs.listChildrenPage('user://', { limit: 1 })).toEqual({
      entries: [{ path: 'user://image.png', name: 'image.png', kind: 'file' }],
      offset: 0,
      limit: 1,
      truncated: true,
      nextOffset: 1
    });

    expect(await vfs.listChildrenPage('user://', { offset: 1, limit: 1 })).toEqual({
      entries: [{ path: 'user://samples', name: 'samples', kind: 'directory' }],
      offset: 1,
      limit: 1,
      truncated: false
    });

    await expect(vfs.listChildren('user://image.png')).rejects.toThrow(
      'VFS: Path is not a directory: user://image.png'
    );

    expect(await vfs.search('snare', 'user://')).toEqual([
      { path: 'user://samples/snares/snare.wav', name: 'snare.wav', kind: 'file' }
    ]);

    expect(await vfs.searchPage('sample', 'user://', { limit: 1 })).toEqual({
      entries: [{ path: 'user://samples', name: 'samples', kind: 'directory' }],
      offset: 0,
      limit: 1,
      truncated: true,
      nextOffset: 1
    });

    expect(await vfs.searchPage('sample', 'user://', { offset: 1, limit: 1 })).toEqual({
      entries: [{ path: 'user://samples/kick.wav', name: 'kick.wav', kind: 'file' }],
      offset: 1,
      limit: 1,
      truncated: true,
      nextOffset: 2
    });
  });

  it('does not include paths that only share a directory prefix', () => {
    const vfs = VirtualFilesystem.getInstance();
    const entry = { provider: 'url' as const, filename: 'placeholder' };
    vfs.registerEntry('user://samples/kick.wav', entry);
    vfs.registerEntry('user://samples-old/snare.wav', entry);

    expect(vfs.list('user://samples')).toEqual(['user://samples/kick.wav']);
  });

  it('lists and searches the contents of linked local folders', async () => {
    const linkedFolder = {
      name: 'samples',
      getDirectoryHandle: async () => kicksFolder,
      async *values() {
        yield { name: 'kicks', kind: 'directory' };
        yield { name: 'snare.wav', kind: 'file' };
      }
    } as unknown as FileSystemDirectoryHandle;

    const kicksFolder = {
      name: 'kicks',
      async *values() {
        yield { name: 'kick.wav', kind: 'file' };
      },
      getDirectoryHandle: async () => kicksFolder
    } as unknown as FileSystemDirectoryHandle;

    const localProvider = {
      type: 'local' as const,
      resolve: async () => new Blob(),
      storeDirHandle: async () => {},
      getDirHandle: async () => linkedFolder,
      hasDirPermission: async () => true,
      listHandleContents: async (
        handle: FileSystemDirectoryHandle,
        options?: { offset?: number; limit?: number }
      ) => {
        const entries = [] as Array<{
          name: string;
          kind: 'file' | 'directory';
          handle: FileSystemHandle;
        }>;

        for await (const handleEntry of handle.values()) {
          entries.push({ ...handleEntry, handle: handleEntry as FileSystemHandle });
        }

        const offset = options?.offset ?? 0;
        const limit = options?.limit ?? entries.length;

        return entries.slice(offset, offset + limit);
      }
    };

    const vfs = VirtualFilesystem.getInstance();
    vfs.registerProvider(localProvider);
    vfs.registerEntry('user://samples', { provider: 'local-folder', filename: 'samples' });

    expect(await vfs.listChildren('user://samples')).toEqual([
      { path: 'user://samples/kicks', name: 'kicks', kind: 'directory' },
      { path: 'user://samples/snare.wav', name: 'snare.wav', kind: 'file' }
    ]);

    expect(await vfs.listChildrenPage('user://samples', { limit: 1 })).toEqual({
      entries: [{ path: 'user://samples/kicks', name: 'kicks', kind: 'directory' }],
      offset: 0,
      limit: 1,
      truncated: true,
      nextOffset: 1
    });

    expect(await vfs.search('kick', 'user://')).toEqual([
      { path: 'user://samples/kicks', name: 'kicks', kind: 'directory' },
      { path: 'user://samples/kicks/kick.wav', name: 'kick.wav', kind: 'file' }
    ]);

    expect(await vfs.searchPage('kick', 'user://', { limit: 1 })).toEqual({
      entries: [{ path: 'user://samples/kicks', name: 'kicks', kind: 'directory' }],
      offset: 0,
      limit: 1,
      truncated: true,
      nextOffset: 1
    });
  });
});
