import { beforeEach, describe, expect, it } from 'vitest';

import { HistoryManager } from '$lib/history';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import type { VfsPathRenamedEvent } from '$lib/eventbus/events';
import { getPatchImportError, VirtualFilesystem } from './VirtualFilesystem';
import type { EmbeddedVFSEntry } from './types';

describe('VirtualFilesystem patch files', () => {
  beforeEach(() => {
    VirtualFilesystem.resetInstance();
    HistoryManager.getInstance().clear();
  });

  it('round-trips embedded content and its revision through serialization', async () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.createEmbeddedFile('patch://shaders/noise.glsl', 'float noise() { return 1.; }');
    vfs.writeEmbeddedFile('patch://shaders/noise.glsl', 'float noise() { return 2.; }');

    const serialized = vfs.serialize();

    VirtualFilesystem.resetInstance();
    const hydrated = VirtualFilesystem.getInstance();
    await hydrated.hydrate(serialized);

    expect(hydrated.readEmbeddedFile('patch://shaders/noise.glsl')).toBe(
      'float noise() { return 2.; }'
    );
    expect(hydrated.getEntry('patch://shaders/noise.glsl')).toMatchObject({ revision: 2 });
  });

  it('keeps user files in their namespace when a patch has no embedded files', async () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.registerEntry('user://shared.js', {
      provider: 'url',
      filename: 'shared.js',
      url: '/shared.js'
    });

    await vfs.hydrate({
      patch: {},
      user: { 'shared.js': { provider: 'url', filename: 'shared.js', url: '/shared.js' } }
    });

    expect(vfs.getEntry('user://shared.js')).toMatchObject({ provider: 'url' });
    expect(vfs.getEntry('patch://shared.js')).toBeUndefined();
  });

  it('rejects embedded entries outside Patch and enforces embedded byte limits', () => {
    const vfs = VirtualFilesystem.getInstance();

    expect(() =>
      vfs.registerEntry('user://not-portable.js', {
        provider: 'embedded',
        filename: 'not-portable.js',
        content: 'export {}'
      } as never)
    ).toThrow('only valid under patch://');

    expect(() => vfs.createEmbeddedFile('patch://large.txt', 'x'.repeat(256 * 1024 + 1))).toThrow(
      'exceeds 256 KiB'
    );
  });

  it('rejects known binary formats and oversized files before decoding them', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const zip = new File(['PK'], 'archive.zip', { type: 'application/zip' });
    const pdf = new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' });
    const large = new File(['x'.repeat(256 * 1024 + 1)], 'large.txt', { type: 'text/plain' });

    expect(getPatchImportError(zip)).toContain('not a supported text file');
    expect(getPatchImportError(pdf)).toContain('not a supported text file');
    expect(getPatchImportError(large)).toContain('256 KiB');

    await expect(vfs.importToPatch([zip])).rejects.toThrow('not a supported text file');
    expect(vfs.getEntry('patch://archive.zip')).toBeUndefined();
  });

  it('rejects an oversized User file before trying to resolve it for a Patch copy', async () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.registerEntry('user://large.txt', {
      provider: 'url',
      filename: 'large.txt',
      size: 256 * 1024 + 1,
      url: 'https://example.test/large.txt'
    });

    await expect(vfs.copyToPatch('user://large.txt')).rejects.toThrow('exceeds 256 KiB');
  });

  it('uses numbered names for collision-safe imports and leaves rejected batches untouched', async () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.createEmbeddedFile('patch://utility.js', 'export const one = 1');

    const imported = await vfs.importToPatch(
      [new File(['export const two = 2'], 'utility.js', { type: 'text/javascript' })],
      'patch://',
      'keep-both'
    );

    expect(imported).toEqual(['patch://utility-1.js']);
    expect(vfs.readEmbeddedFile('patch://utility-1.js')).toContain('two');

    await expect(
      vfs.importToPatch([
        new File(['valid'], 'valid.txt'),
        new File(['x'.repeat(256 * 1024 + 1)], 'too-large.txt')
      ])
    ).rejects.toThrow('exceeds 256 KiB');

    expect(vfs.getEntry('patch://valid.txt')).toBeUndefined();
  });

  it('keeps folder imports relative to the selected Patch folder', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const file = new File(['export const color = 1'], 'color.js');
    Object.defineProperty(file, 'webkitRelativePath', { value: 'shaders/palette/color.js' });

    await vfs.importToPatch([file], 'patch://assets');

    expect(vfs.readEmbeddedFile('patch://assets/shaders/palette/color.js')).toContain('color');
  });

  it('rejects a folder rename that would overwrite a descendant', () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.createFolder('patch://', 'source');
    vfs.createEmbeddedFile('patch://source/utility.js', 'export const source = true');
    vfs.createEmbeddedFile('patch://target/utility.js', 'export const target = true');

    expect(() => vfs.renamePath('patch://source', 'patch://target')).toThrow(
      'Path already exists: patch://target/utility.js'
    );
    expect(vfs.readEmbeddedFile('patch://source/utility.js')).toContain('source');
    expect(vfs.readEmbeddedFile('patch://target/utility.js')).toContain('target');
  });

  it('uses the final size when replacing an embedded import', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const fullSize = 256 * 1024;
    vfs.createEmbeddedFile('patch://replace.js', 'a'.repeat(fullSize));
    vfs.createEmbeddedFile('patch://one.js', 'b'.repeat(fullSize));
    vfs.createEmbeddedFile('patch://two.js', 'c'.repeat(fullSize));
    vfs.createEmbeddedFile('patch://three.js', 'd'.repeat(fullSize));

    await expect(
      vfs.importToPatch([new File(['e'.repeat(fullSize)], 'replace.js')], 'patch://', 'replace')
    ).resolves.toEqual(['patch://replace.js']);
  });

  it('restores content and revisions with global undo and redo', () => {
    const vfs = VirtualFilesystem.getInstance();
    const history = HistoryManager.getInstance();
    vfs.createEmbeddedFile('patch://utility.js', 'export const value = 1');
    vfs.writeEmbeddedFile('patch://utility.js', 'export const value = 2');

    history.undo();
    expect(vfs.readEmbeddedFile('patch://utility.js')).toContain('1');
    expect(vfs.getEntry('patch://utility.js')).toMatchObject({ revision: 1 });

    history.redo();
    expect(vfs.readEmbeddedFile('patch://utility.js')).toContain('2');
    expect(vfs.getEntry('patch://utility.js')).toMatchObject({ revision: 2 });
  });

  it('emits reverse and forward path changes when undoing and redoing a rename', () => {
    const vfs = VirtualFilesystem.getInstance();
    const history = HistoryManager.getInstance();
    const eventBus = PatchiesEventBus.getInstance();
    const renames: VfsPathRenamedEvent[] = [];
    const handleRename = (event: VfsPathRenamedEvent) => {
      renames.push(event);
    };
    eventBus.addEventListener('vfsPathRenamed', handleRename);

    vfs.createEmbeddedFile('patch://before.js', 'export {}');
    history.clear();
    vfs.renamePath('patch://before.js', 'patch://after.js');
    history.undo();
    history.redo();

    expect(renames).toEqual([
      { type: 'vfsPathRenamed', oldPath: 'patch://before.js', newPath: 'patch://after.js' },
      { type: 'vfsPathRenamed', oldPath: 'patch://after.js', newPath: 'patch://before.js' },
      { type: 'vfsPathRenamed', oldPath: 'patch://before.js', newPath: 'patch://after.js' }
    ]);

    eventBus.removeEventListener('vfsPathRenamed', handleRename);
  });

  it('clears path-only provider caches when switching patches', async () => {
    const vfs = VirtualFilesystem.getInstance();
    let activeContent = 'patch-a';
    let cachedFile: File | undefined;

    vfs.registerProvider({
      type: 'local',
      resolve: async () => {
        cachedFile ??= new File([activeContent], 'shared.txt');

        return cachedFile;
      },
      clear: () => {
        cachedFile = undefined;
      },
      clearDirHandles: () => {},
      storeDirHandle: async () => {}
    } as never);
    vfs.registerEntry('user://shared.txt', { provider: 'local', filename: 'shared.txt' });

    await expect((await vfs.resolve('user://shared.txt')).text()).resolves.toBe('patch-a');

    activeContent = 'patch-b';
    vfs.clear();
    vfs.registerEntry('user://shared.txt', { provider: 'local', filename: 'shared.txt' });

    await expect((await vfs.resolve('user://shared.txt')).text()).resolves.toBe('patch-b');
  });

  it('loads oversized embedded files for recovery but refuses to resolve them', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const content = 'x'.repeat(256 * 1024 + 1);

    await vfs.hydrate({
      patch: {
        'oversized.txt': {
          provider: 'embedded',
          filename: 'oversized.txt',
          content,
          size: content.length
        } as EmbeddedVFSEntry
      }
    });

    expect(vfs.getEntry('patch://oversized.txt')).toBeDefined();
    expect(() => vfs.readEmbeddedFile('patch://oversized.txt')).toThrow('exceeds 256 KiB');
    await expect(vfs.resolve('patch://oversized.txt')).rejects.toThrow('exceeds 256 KiB');
    await expect(vfs.exportEmbeddedFile('patch://oversized.txt').text()).resolves.toBe(content);
  });

  it('deletes selected ancestors and descendants as one undoable operation', () => {
    const vfs = VirtualFilesystem.getInstance();
    const history = HistoryManager.getInstance();
    vfs.createFolder('patch://', 'folder');
    vfs.createEmbeddedFile('patch://folder/child.js', 'export {}');
    history.clear();

    vfs.deletePaths(['patch://folder', 'patch://folder/child.js']);

    expect(vfs.getEntry('patch://folder')).toBeUndefined();
    expect(vfs.getEntry('patch://folder/child.js')).toBeUndefined();

    history.undo();
    expect(vfs.getEntry('patch://folder')).toBeDefined();
    expect(vfs.getEntry('patch://folder/child.js')).toBeDefined();
  });
});
