import type { Node } from '@xyflow/svelte';
import { HistoryManager } from '$lib/history';
import { UpdateNodeDataCommand } from '$lib/history/commands/update-node-data.command';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { VirtualFilesystem } from './VirtualFilesystem';
import { PatchFileEditorSession } from './PatchFileEditorSession';
import {
  getObjectCodeFiles,
  editObjectCodeFile,
  type CodeObject
} from '$lib/objects/object-code-files';
import {
  listVfsEntries,
  resolveVfsUrl,
  revokeWorkerVfsObjectUrls
} from './worker-vfs-request-handler';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import { createVfsApi } from './user-api';

const jsPath = 'obj://js-6/code.js';

describe('live object files', () => {
  let vfs: VirtualFilesystem;
  let objects: CodeObject[];

  beforeEach(() => {
    VirtualFilesystem.resetInstance();
    vfs = VirtualFilesystem.getInstance();
    objects = [
      { id: 'glsl-4', type: 'glsl', data: { code: 'void main() {}' } },
      { id: 'js-6', type: 'js', data: { code: 'send(1)' } },
      { id: 'slider-1', type: 'slider', data: { value: 1 } }
    ];
    vfs.objectFiles.connect((file, content) => {
      objects = objects.map((object) =>
        object.id === file.objectId
          ? {
              ...object,
              data: {
                ...object.data,
                ...editObjectCodeFile(object, file.filename, content).updates
              }
            }
          : object
      );
      vfs.objectFiles.sync(objects);
    });
    vfs.objectFiles.sync(objects);
  });

  it('lists and reads current sources through the main and worker APIs', async () => {
    expect(await createVfsApi(() => {}).list('obj://')).toEqual([
      { path: 'obj://glsl-4', name: 'glsl-4', kind: 'directory' },
      { path: 'obj://js-6', name: 'js-6', kind: 'directory' }
    ]);
    expect(await listVfsEntries('obj://glsl-4')).toEqual({
      entries: [{ path: 'obj://glsl-4/shader.glsl', name: 'shader.glsl', kind: 'file' }]
    });

    expect(await (await vfs.resolve(jsPath)).text()).toBe('send(1)');
    expect(await vfs.search('shader', 'obj://')).toEqual([
      { path: 'obj://glsl-4/shader.glsl', name: 'shader.glsl', kind: 'file' }
    ]);
    expect((await vfs.listChildrenPage('obj://', { limit: 1 })).nextOffset).toBe(1);
    expect((await vfs.searchPage('code', 'obj://')).entries).toHaveLength(1);

    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:object-code');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    expect(await resolveVfsUrl('worker-1', jsPath)).toEqual({ url: 'blob:object-code' });
    expect(await (createUrl.mock.calls[0][0] as Blob).text()).toBe('send(1)');
    revokeWorkerVfsObjectUrls('worker-1');
    expect(revokeUrl).toHaveBeenCalledWith('blob:object-code');
    vi.restoreAllMocks();
  });

  it('reads object text with the public fluent get API', async () => {
    vi.stubGlobal('window', {});
    const urls: string[] = [];

    try {
      const api = createVfsApi((url) => urls.push(url));
      expect(await api.get(jsPath).text()).toBe('send(1)');
    } finally {
      urls.forEach((url) => URL.revokeObjectURL(url));
      vi.unstubAllGlobals();
    }
  });

  it('writes typing immediately to original fields and synchronizes external edits and deletion', () => {
    const editor = new PatchFileEditorSession(vfs);
    editor.open(jsPath);
    editor.updateDraft('send(2)');

    expect(vfs.readCodeFile(jsPath)).toBe('send(2)');
    expect(objects[1].data.code).toBe('send(2)');
    expect(editor.save()).toBe(true);
    expect(objects[1].data.code).toBe('send(2)');
    expect(editor.isDirty).toBe(false);

    objects[1].data.code = 'send(3)';
    vfs.objectFiles.sync(objects);
    expect(editor.syncSavedContent()).toBe('updated');
    expect(editor.draft).toBe('send(3)');

    editor.updateDraft('local draft');
    objects[1].data.code = 'external edit';
    vfs.objectFiles.sync(objects);
    expect(editor.syncSavedContent()).toBe('updated');
    expect(editor.draft).toBe('external edit');

    editor.discard();
    editor.syncSavedContent();
    vfs.objectFiles.sync([]);
    expect(editor.syncSavedContent()).toBe('deleted');
    expect(() => vfs.writeCodeFile(jsPath, 'cannot recreate')).toThrow();
    expect(get(vfs.entries$).size).toBe(0);
  });

  it('closes safely if the object disappears during live editing', () => {
    const editor = new PatchFileEditorSession(vfs);
    editor.open(jsPath);
    editor.updateDraft('live edit');
    vfs.objectFiles.sync([]);

    expect(() => editor.close()).not.toThrow();
    expect(editor.isOpen).toBe(false);
    expect(vfs.has(jsPath)).toBe(false);
  });

  it('refreshes cached object editors when reopened', () => {
    const editor = new PatchFileEditorSession(vfs);
    editor.open(jsPath);
    editor.close();

    objects[1].data.code = 'changed while closed';
    vfs.objectFiles.sync(objects);
    editor.open(jsPath);
    expect(editor.draft).toBe('changed while closed');
    expect(editor.isDirty).toBe(false);
  });

  it('saves the latest document before Run and reruns unchanged code', async () => {
    const run = vi.fn((file) => {
      expect(file.content).toBe('latest document');
      expect(objects[1].data.code).toBe('latest document');
    });
    vfs.objectFiles.connect((file, content) => {
      objects[1].data[file.dataKey] = content;
      vfs.objectFiles.sync(objects);
    }, run);
    const editor = new PatchFileEditorSession(vfs);
    editor.open(jsPath);
    editor.updateDraft('older draft');
    expect(objects[1].data.code).toBe('older draft');
    expect(run).not.toHaveBeenCalled();

    await editor.run('latest document');
    await editor.run();
    expect(run).toHaveBeenCalledTimes(2);
    expect(editor.isDirty).toBe(false);

    editor.updateDraft('save only');
    editor.save();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps stable revisions for unrelated graph updates and emits changes on undo-like updates', () => {
    const events: string[] = [];
    const listener = (event: { path: string }) => events.push(event.path);
    const bus = PatchiesEventBus.getInstance();
    bus.addEventListener('vfsContentModified', listener);
    const revision = vfs.getEntry(jsPath)?.revision;

    objects[2].data.value = 2;
    vfs.objectFiles.sync(objects);
    expect(vfs.getEntry(jsPath)?.revision).toBe(revision);
    expect(events).toEqual([]);

    vfs.writeCodeFile(jsPath, 'new code');
    objects[1].data.code = 'send(1)';
    vfs.objectFiles.sync(objects);
    expect(events).toEqual([jsPath, jsPath]);
    expect(vfs.readCodeFile(jsPath)).toBe('send(1)');
    bus.removeEventListener('vfsContentModified', listener);
  });

  it('groups live typing into one node undo step and propagates undo and redo', () => {
    const history = HistoryManager.getInstance();
    history.clear();
    let nodes: Node[] = objects.map((object) => ({ ...object, position: { x: 0, y: 0 } }));
    const accessors = {
      getNodes: () => nodes,
      setNodes: (next: Node[]) => {
        nodes = next;
        vfs.objectFiles.sync(nodes);
      },
      getEdges: () => [],
      setEdges: () => {}
    };
    vfs.objectFiles.connect((file, content, options) => {
      const command = new UpdateNodeDataCommand(
        file.objectId,
        file.dataKey,
        options?.previousContent ?? file.content,
        content,
        accessors
      );
      command.execute();
      if (options?.recordHistory !== false) history.record(command);
    });
    const editor = new PatchFileEditorSession(vfs);
    editor.open(jsPath);
    editor.updateDraft('send(');
    editor.updateDraft('send(2');
    editor.updateDraft('send(2)');
    expect(nodes[1].data.code).toBe('send(2)');
    expect(history.canUndo()).toBe(false);

    expect(editor.undoDraft()).toBe(true);
    expect(editor.draft).toBe('send(1)');
    expect(nodes[1].data.code).toBe('send(1)');

    expect(editor.redoDraft()).toBe(true);
    expect(editor.draft).toBe('send(2)');
    expect(nodes[1].data.code).toBe('send(2)');
    history.clear();
  });

  it('rejects structural mutations atomically, including import and upload destinations', async () => {
    vfs.createEmbeddedFile('patch://keep.js', 'keep');
    const file = new File(['new'], 'new.js');

    expect(() => vfs.createFolder('obj://js-6', 'folder')).toThrow();
    expect(() =>
      vfs.registerEntry('obj://new.js', { provider: 'local', filename: 'new.js' })
    ).toThrow();
    expect(() => vfs.createEmbeddedFile('obj://new.js')).toThrow();
    expect(() => vfs.renamePath(jsPath, 'obj://js-6/new.js')).toThrow();
    expect(() => vfs.renamePath('patch://keep.js', jsPath)).toThrow();
    expect(() => vfs.deletePaths(['patch://keep.js', jsPath])).toThrow();
    expect(() => vfs.remove(jsPath)).toThrow();

    await expect(vfs.storeFile(file, undefined, 'obj://js-6')).rejects.toThrow();
    await expect(vfs.registerUrl('https://example.com/new.js', 'obj://')).rejects.toThrow();
    await expect(vfs.replaceFile(jsPath, file)).rejects.toThrow();
    await expect(vfs.importToPatch([file], 'obj://')).rejects.toThrow();
    expect(vfs.readEmbeddedFile('patch://keep.js')).toBe('keep');
    expect(vfs.readCodeFile(jsPath)).toBe('send(1)');
    expect(vfs.serialize()).not.toHaveProperty('obj');
    expect(vfs.serialize()).not.toHaveProperty('objects');
  });

  it('provides reusable source descriptors and validated edits without VFS', () => {
    const object = { id: 'uiua-1', type: 'uiua', data: { expr: '1 2 +' } };
    expect(getObjectCodeFiles(object)).toEqual([
      {
        objectId: 'uiua-1',
        filename: 'code.ua',
        dataKey: 'expr',
        language: 'uiua',
        content: '1 2 +'
      }
    ]);
    expect(editObjectCodeFile(object, 'code.ua', '3').updates).toEqual({ expr: '3' });
    expect(object.data.expr).toBe('1 2 +');
    expect(() => editObjectCodeFile(object, 'other.ua', '3')).toThrow();
    expect(
      getObjectCodeFiles({ id: 'module-1', type: 'js.module', data: { vfsPath: 'patch://a.js' } })
    ).toEqual([]);
  });
});
