import { beforeEach, describe, expect, it } from 'vitest';

import { HistoryManager } from '$lib/history';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import type { VfsPathRenamedEvent } from '$lib/eventbus/events';
import type { VfsContentModifiedEvent } from '$lib/eventbus/events';
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

  it('keeps object files runtime-only during serialization and hydration', async () => {
    const vfs = VirtualFilesystem.getInstance();

    vfs.registerEntry('obj://script-1/source.js', {
      provider: 'url',
      filename: 'source.js',
      url: '/source.js'
    });

    expect(vfs.getEntry('obj://script-1/source.js')).toBeDefined();
    expect(vfs.serialize()).toEqual({});

    await vfs.hydrate({
      objects: {
        'legacy-object': {
          'source.js': { provider: 'url', filename: 'source.js', url: '/legacy.js' }
        }
      }
    } as never);

    expect(vfs.getEntry('obj://legacy-object/source.js')).toBeUndefined();
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

  it('imports complete folder trees atomically and applies one collision strategy to the root', async () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.createFolder('patch://', 'bundle');
    vfs.createEmbeddedFile('patch://bundle/old.js', 'export const old = true');

    const items = [
      { kind: 'directory' as const, relativePath: 'bundle' },
      { kind: 'directory' as const, relativePath: 'bundle/empty' },
      {
        kind: 'file' as const,
        relativePath: 'bundle/src/index.js',
        file: new File(['export const next = true'], 'index.js', { type: 'text/javascript' })
      }
    ];

    expect(vfs.getPatchImportCollisions(items)).toEqual(['patch://bundle']);

    await expect(vfs.importToPatch(items, 'patch://', 'keep-both')).resolves.toEqual([
      'patch://bundle-1/src/index.js'
    ]);

    expect(vfs.getEntry('patch://bundle-1')).toMatchObject({ provider: 'folder' });
    expect(vfs.getEntry('patch://bundle-1/empty')).toMatchObject({ provider: 'folder' });
    expect(vfs.readEmbeddedFile('patch://bundle-1/src/index.js')).toContain('next');
    expect(vfs.readEmbeddedFile('patch://bundle/old.js')).toContain('old');

    await expect(
      vfs.importToPatch(
        [
          { kind: 'directory', relativePath: 'rejected' },
          {
            kind: 'file',
            relativePath: 'rejected/valid.txt',
            file: new File(['valid'], 'valid.txt', { type: 'text/plain' })
          },
          {
            kind: 'file',
            relativePath: 'rejected/archive.zip',
            file: new File(['PK'], 'archive.zip', { type: 'application/zip' })
          }
        ],
        'patch://',
        'replace'
      )
    ).rejects.toThrow('archive.zip is not a supported text file');

    expect(vfs.getEntry('patch://rejected')).toBeUndefined();
    expect(vfs.getEntry('patch://rejected/valid.txt')).toBeUndefined();
  });

  it('replaces and restores complete imported folder trees as one history operation', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const history = HistoryManager.getInstance();

    vfs.createFolder('patch://', 'bundle');
    vfs.createEmbeddedFile('patch://bundle/old.js', 'export const old = true');
    history.clear();

    await vfs.importToPatch(
      [
        { kind: 'directory', relativePath: 'bundle' },
        {
          kind: 'file',
          relativePath: 'bundle/new.js',
          file: new File(['export const next = true'], 'new.js', { type: 'text/javascript' })
        }
      ],
      'patch://',
      'replace'
    );

    expect(vfs.getEntry('patch://bundle/old.js')).toBeUndefined();
    expect(vfs.readEmbeddedFile('patch://bundle/new.js')).toContain('next');

    history.undo();
    expect(vfs.readEmbeddedFile('patch://bundle/old.js')).toContain('old');
    expect(vfs.getEntry('patch://bundle/new.js')).toBeUndefined();
  });

  it('keeps a file separate from an existing implicit directory collision', async () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.createEmbeddedFile('patch://utility/dependency.js', 'export {}');

    await expect(
      vfs.importToPatch(
        [new File(['root'], 'utility', { type: 'text/plain' })],
        'patch://',
        'keep-both'
      )
    ).resolves.toEqual(['patch://utility-1']);

    expect(vfs.getEntry('patch://utility')).toBeUndefined();
    expect(vfs.readEmbeddedFile('patch://utility-1')).toBe('root');
  });

  it('increments replacement import revisions and restores them through undo and redo', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const history = HistoryManager.getInstance();
    vfs.createEmbeddedFile('patch://utility.js', 'export const value = 1');
    vfs.writeEmbeddedFile('patch://utility.js', 'export const value = 2');
    history.clear();

    await vfs.importToPatch(
      [new File(['export const value = 3'], 'utility.js', { type: 'text/javascript' })],
      'patch://',
      'replace'
    );

    expect(vfs.getEntry('patch://utility.js')).toMatchObject({ revision: 3 });
    expect(vfs.readEmbeddedFile('patch://utility.js')).toContain('3');

    history.undo();
    expect(vfs.getEntry('patch://utility.js')).toMatchObject({ revision: 2 });
    expect(vfs.readEmbeddedFile('patch://utility.js')).toContain('2');

    history.redo();
    expect(vfs.getEntry('patch://utility.js')).toMatchObject({ revision: 3 });
    expect(vfs.readEmbeddedFile('patch://utility.js')).toContain('3');
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

  it('emits monotonic content revisions across Save, undo, and redo', () => {
    const vfs = VirtualFilesystem.getInstance();
    const history = HistoryManager.getInstance();
    const revisions: number[] = [];
    const listener = (event: VfsContentModifiedEvent) => revisions.push(event.revision);

    PatchiesEventBus.getInstance().addEventListener('vfsContentModified', listener);

    vfs.createEmbeddedFile('patch://utility.glsl', 'float value = 1.0;');
    vfs.writeEmbeddedFile('patch://utility.glsl', 'float value = 2.0;');
    history.undo();
    history.redo();

    expect(revisions).toEqual([1, 2, 3, 4]);

    PatchiesEventBus.getInstance().removeEventListener('vfsContentModified', listener);
  });

  it('restores local file bytes and metadata when replacement is undone and redone', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const history = HistoryManager.getInstance();

    let storedFile: File | undefined = new File(['before'], 'before.txt', { type: 'text/plain' });

    vfs.registerProvider({
      type: 'local',
      resolve: async () => {
        if (!storedFile) throw new Error('missing file');

        return storedFile;
      },
      storeDirHandle: async () => {},
      captureFileState: async () => ({ file: storedFile }),
      restoreFileState: async (_path: string, state: { file?: File }) => {
        storedFile = state.file;
      }
    } as never);

    vfs.registerEntry('user://before.txt', {
      provider: 'local',
      filename: 'before.txt',
      mimeType: 'text/plain',
      size: 6
    });
    history.clear();

    await vfs.replaceFile(
      'user://before.txt',
      new File(['after'], 'after.txt', { type: 'text/markdown' })
    );

    expect(vfs.getEntry('user://before.txt')).toMatchObject({
      filename: 'after.txt',
      mimeType: 'text/markdown',
      size: 5
    });

    await expect((await vfs.resolve('user://before.txt')).text()).resolves.toBe('after');

    history.undo();
    expect(vfs.getEntry('user://before.txt')).toMatchObject({
      filename: 'before.txt',
      mimeType: 'text/plain',
      size: 6
    });

    await expect((await vfs.resolve('user://before.txt')).text()).resolves.toBe('before');

    history.redo();
    expect(vfs.getEntry('user://before.txt')).toMatchObject({
      filename: 'after.txt',
      mimeType: 'text/markdown',
      size: 5
    });

    await expect((await vfs.resolve('user://before.txt')).text()).resolves.toBe('after');
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

  it('rewrites Patch module imports with the file rename and restores them through history', () => {
    const vfs = VirtualFilesystem.getInstance();
    const history = HistoryManager.getInstance();

    vfs.createEmbeddedFile('patch://lib/math.js', 'export const value = 1');
    vfs.createEmbeddedFile(
      'patch://consumer.js',
      [
        "import { value } from './lib/math.js'",
        "export { value as rootValue } from 'lib/math'",
        "const load = () => import('patch://lib/math.js')"
      ].join('\n')
    );
    history.clear();

    vfs.renamePath('patch://lib/math.js', 'patch://lib/numbers.js');

    expect(vfs.readEmbeddedFile('patch://consumer.js')).toContain("from './lib/numbers.js'");
    expect(vfs.readEmbeddedFile('patch://consumer.js')).toContain("from 'lib/numbers'");
    expect(vfs.readEmbeddedFile('patch://consumer.js')).toContain(
      "import('patch://lib/numbers.js')"
    );

    history.undo();

    expect(vfs.readEmbeddedFile('patch://consumer.js')).toContain("from './lib/math.js'");
    expect(vfs.readEmbeddedFile('patch://consumer.js')).toContain("from 'lib/math'");
    expect(vfs.readEmbeddedFile('patch://consumer.js')).toContain("import('patch://lib/math.js')");
  });

  it('rewrites only module specifiers when renaming a Patch JavaScript file', () => {
    const vfs = VirtualFilesystem.getInstance();

    vfs.createEmbeddedFile('patch://utils.js', 'export const value = 1');
    vfs.createEmbeddedFile(
      'patch://consumer.js',
      [
        "import { value } from 'utils'",
        'const label = "from \'utils\'"',
        "// import { value } from 'utils'"
      ].join('\n')
    );

    vfs.renamePath('patch://utils.js', 'patch://numbers.js');

    expect(vfs.readEmbeddedFile('patch://consumer.js')).toBe(
      [
        "import { value } from 'numbers'",
        'const label = "from \'utils\'"',
        "// import { value } from 'utils'"
      ].join('\n')
    );
  });

  it('serializes persisted renames when undo follows an in-flight move', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const history = HistoryManager.getInstance();
    const calls: string[] = [];

    let releaseFirstMove: () => void;
    let markFirstMoveStarted: () => void;
    let markSecondMoveFinished: () => void;

    const firstMoveStarted = new Promise<void>((resolve) => {
      markFirstMoveStarted = resolve;
    });

    const firstMoveReleased = new Promise<void>((resolve) => {
      releaseFirstMove = resolve;
    });

    const secondMoveFinished = new Promise<void>((resolve) => {
      markSecondMoveFinished = resolve;
    });

    vfs.registerProvider({
      type: 'local',
      resolve: async () => new Blob(),
      storeDirHandle: async () => {},
      rename: async (from: string, to: string) => {
        calls.push(`${from}->${to}`);
        if (calls.length === 1) {
          markFirstMoveStarted();
          await firstMoveReleased;
        } else {
          markSecondMoveFinished();
        }
      }
    } as never);
    vfs.registerEntry('user://before.txt', { provider: 'local', filename: 'before.txt' });
    history.clear();

    vfs.renamePath('user://before.txt', 'user://after.txt');
    await firstMoveStarted;
    history.undo();

    expect(calls).toEqual(['user://before.txt->user://after.txt']);

    releaseFirstMove!();
    await secondMoveFinished;

    expect(calls).toEqual([
      'user://before.txt->user://after.txt',
      'user://after.txt->user://before.txt'
    ]);
  });

  it('restores pending permissions when undoing a deletion', async () => {
    const vfs = VirtualFilesystem.getInstance();
    const history = HistoryManager.getInstance();
    vfs.registerProvider({
      type: 'local',
      resolve: async () => new Blob(),
      needsPermission: async () => true,
      storeDirHandle: async () => {}
    } as never);
    await vfs.hydrate({
      user: {
        'locked.txt': { provider: 'local', filename: 'locked.txt' }
      }
    });
    history.clear();

    expect(vfs.getPendingPermissions()).toEqual(['user://locked.txt']);

    vfs.deletePath('user://locked.txt');
    history.undo();

    expect(vfs.getPendingPermissions()).toEqual(['user://locked.txt']);
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

  it('emits embedded deletion revisions for low-level remove and clear', () => {
    const vfs = VirtualFilesystem.getInstance();
    const eventBus = PatchiesEventBus.getInstance();
    const deletions: VfsContentModifiedEvent[] = [];
    const handleContentModified = (event: VfsContentModifiedEvent) => deletions.push(event);

    vfs.createEmbeddedFile('patch://removed.glsl', 'float removed = 1.0;');
    vfs.createEmbeddedFile('patch://cleared.glsl', 'float cleared = 1.0;');
    eventBus.addEventListener('vfsContentModified', handleContentModified);

    vfs.remove('patch://removed.glsl');
    vfs.clear();

    expect(deletions).toEqual([
      { type: 'vfsContentModified', path: 'patch://removed.glsl', revision: 2 },
      { type: 'vfsContentModified', path: 'patch://cleared.glsl', revision: 2 }
    ]);

    eventBus.removeEventListener('vfsContentModified', handleContentModified);
  });

  it('keeps revisions monotonic when a cleared path is recreated', () => {
    const vfs = VirtualFilesystem.getInstance();
    const eventBus = PatchiesEventBus.getInstance();
    const revisions: number[] = [];
    const handleContentModified = (event: VfsContentModifiedEvent) => {
      if (event.path === 'patch://recreated.glsl') revisions.push(event.revision);
    };

    eventBus.addEventListener('vfsContentModified', handleContentModified);

    vfs.createEmbeddedFile('patch://recreated.glsl', 'float value = 1.0;');
    vfs.clear();
    vfs.createEmbeddedFile('patch://recreated.glsl', 'float value = 2.0;');

    expect(revisions).toEqual([1, 2, 3]);

    eventBus.removeEventListener('vfsContentModified', handleContentModified);
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
