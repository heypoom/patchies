import { beforeEach, describe, expect, it } from 'vitest';
import { HistoryManager } from '$lib/history';
import { VirtualFilesystem } from './VirtualFilesystem';
import { mountPathToVfs, readMountTree, writeMountFile } from './VfsMountTree';

describe('VFS mount tree', () => {
  let vfs: VirtualFilesystem;

  beforeEach(() => {
    VirtualFilesystem.resetInstance();
    vfs = VirtualFilesystem.getInstance();
    HistoryManager.getInstance().clear();
  });

  it('matches recursive sidebar listings with shared object filenames and empty directories', async () => {
    vfs.objectFiles.sync([
      { id: 'glsl-1', type: 'glsl', data: { code: 'shader' } },
      { id: 'hydra-2', type: 'hydra', data: { code: 'osc()' } },
      { id: 'python-3', type: 'python', data: { code: 'print(1)' } }
    ]);
    vfs.createEmbeddedFile('patch://lib/nested/module.js', 'export default "こんにちは"');
    vfs.createFolder('patch://', 'empty');
    vfs.registerEntry('user://outside.js', {
      provider: 'url',
      filename: 'outside.js',
      url: 'https://example.com/outside.js'
    });

    const listed: string[] = [];
    const walk = async (uri: string, mounted: string) => {
      listed.push(mounted);
      for (const child of await vfs.listChildren(uri)) {
        const path = `${mounted}/${child.name}`;
        if (child.kind === 'directory') await walk(child.path, path);
        else listed.push(path);
      }
    };
    await walk('obj://', 'objects');
    await walk('patch://', 'patch');

    const tree = readMountTree(vfs);
    expect(tree.map((entry) => entry.path).sort()).toEqual(listed.sort());
    expect(tree.find((entry) => entry.path === 'objects/python-3/code.py')?.content).toBe(
      'print(1)'
    );
    expect(tree.find((entry) => entry.path === 'patch/lib/nested/module.js')?.content).toBe(
      'export default "こんにちは"'
    );
  });

  it('uses patch-file history for save, undo, and redo', async () => {
    vfs.createEmbeddedFile('patch://notes.txt', 'before');
    const history = HistoryManager.getInstance();
    history.clear();

    await writeMountFile(vfs, 'patch/notes.txt', 'after');
    expect(vfs.readCodeFile('patch://notes.txt')).toBe('after');
    history.undo();
    expect(readMountTree(vfs).find((entry) => entry.path === 'patch/notes.txt')?.content).toBe(
      'before'
    );
    expect(history.canUndo()).toBe(false);
    history.redo();
    expect(vfs.readCodeFile('patch://notes.txt')).toBe('after');
  });

  it.each(['patch/../outside', 'objects/a/../../b', 'patch//a', 'patch/a\\b', 'user/a'])(
    'rejects %s',
    (path) => {
      expect(() => mountPathToVfs(path)).toThrow();
    }
  );
});
