import { beforeEach, describe, expect, it } from 'vitest';

import { HistoryManager } from '$lib/history';
import { getPatchImportError, VirtualFilesystem } from './VirtualFilesystem';

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
});
