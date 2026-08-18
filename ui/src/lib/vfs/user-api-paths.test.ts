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

  it('lists direct children and searches descendants', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const entry = { provider: 'url' as const, filename: 'placeholder' };
    vfs.registerEntry('user://image.png', entry);
    vfs.registerEntry('user://samples/kick.wav', entry);
    vfs.registerEntry('user://samples/snares/snare.wav', entry);

    expect(await vfs.listChildren('user://')).toEqual(['user://image.png', 'user://samples']);
    expect(await vfs.listChildren('user://samples')).toEqual([
      'user://samples/kick.wav',
      'user://samples/snares'
    ]);
    await expect(vfs.listChildren('user://image.png')).rejects.toThrow(
      'VFS: Path is not a directory: user://image.png'
    );
    expect(await vfs.search('snare', 'user://')).toEqual(['user://samples/snares/snare.wav']);
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
      listHandleContents: async (handle: FileSystemDirectoryHandle) => {
        const entries = [] as Array<{
          name: string;
          kind: 'file' | 'directory';
          handle: FileSystemHandle;
        }>;
        for await (const handleEntry of handle.values()) {
          entries.push({ ...handleEntry, handle: handleEntry as FileSystemHandle });
        }
        return entries;
      }
    };
    const vfs = VirtualFilesystem.getInstance();
    vfs.registerProvider(localProvider);
    vfs.registerEntry('user://samples', { provider: 'local-folder', filename: 'samples' });

    expect(await vfs.listChildren('user://samples')).toEqual([
      'user://samples/kicks',
      'user://samples/snare.wav'
    ]);
    expect(await vfs.search('kick', 'user://')).toEqual([
      'user://samples/kicks',
      'user://samples/kicks/kick.wav'
    ]);
  });
});
