import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddedProvider, VirtualFilesystem } from '$lib/vfs';
import { resolvePdDropPath } from './pd-drop';

describe('resolvePdDropPath', () => {
  beforeEach(() => VirtualFilesystem.resetInstance());

  it('accepts a Pd file dragged from the VFS', async () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.createEmbeddedFile('patch://synth/main.pd', '#N canvas 0 0 200 200 10;');

    await expect(
      resolvePdDropPath({
        getData: (type: string) =>
          type === 'application/x-vfs-path' ? 'patch://synth/main.pd' : ''
      } as DataTransfer)
    ).resolves.toBe('patch://synth/main.pd');
  });

  it('stores and returns a desktop Pd file', async () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.registerProvider(new EmbeddedProvider());
    const file = new File(['#N canvas 0 0 200 200 10;'], 'main.pd', { type: 'text/plain' });
    const storeFile = vi.spyOn(vfs, 'storeFile').mockResolvedValue('user://main.pd');

    await expect(
      resolvePdDropPath({
        files: [file],
        getData: () => ''
      } as unknown as DataTransfer)
    ).resolves.toBe('user://main.pd');

    expect(storeFile).toHaveBeenCalledWith(file, undefined);
  });

  it('rejects non-Pd files', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });

    await expect(
      resolvePdDropPath({
        files: [file],
        getData: () => ''
      } as unknown as DataTransfer)
    ).rejects.toThrow('Choose a .pd patch file.');
  });
});
