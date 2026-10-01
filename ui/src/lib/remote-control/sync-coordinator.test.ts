import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VirtualFilesystem } from '$lib/vfs/VirtualFilesystem';
import { RemoteControlSyncCoordinator } from './sync-coordinator';
import type { CanonicalCommit } from './remote-control-types';
import { HistoryManager, AddNodeCommand } from '$lib/history';
import { RemoteControlGraphService } from './graph-service';
import type { Node } from '@xyflow/svelte';
import type { MountEntry } from '$lib/vfs/VfsMountTree';

type RelayBody = Partial<CanonicalCommit> & {
  representation?: { patchId: string; entries: MountEntry[] };
};

describe('Remote Control VFS synchronization', () => {
  let vfs: VirtualFilesystem;
  let coordinator: RemoteControlSyncCoordinator;
  let patchId: string;
  let objects: { id: string; type: string; data: { code: string } }[];
  let requests: { path: string; body: RelayBody }[];
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let run: ReturnType<typeof vi.fn>;
  let snapshotStatus: number;
  let failWrite: boolean;
  let commitFailures: number;

  beforeEach(() => {
    vi.useFakeTimers();
    const storage = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear()
    });
    commitFailures = 0;
    VirtualFilesystem.resetInstance();
    vfs = VirtualFilesystem.getInstance();
    patchId = 'patch-1';
    objects = [{ id: 'glsl-24', type: 'glsl', data: { code: 'first' } }];
    run = vi.fn();
    failWrite = false;
    snapshotStatus = 204;
    requests = [];

    vfs.objectFiles.connect((file, content) => {
      if (failWrite) throw new Error('history rejected write');

      objects = objects.map((object) =>
        object.id === file.objectId ? { ...object, data: { code: content } } : object
      );
      vfs.objectFiles.sync(objects);
    }, run);
    vfs.objectFiles.sync(objects);
    vfs.createEmbeddedFile('patch://lib/a.js', 'export default 1');

    let sessionCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const path = new URL(input).pathname;
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        requests.push({ path, body });

        if (path === '/api/remote-control/sessions') {
          sessionCount++;
          return Response.json({ sessionId: `session-${sessionCount}`, secret: 'secret' });
        }
        if (path.endsWith('/browser/events')) {
          return new Response(
            new ReadableStream({
              start(next) {
                controller = next;
              }
            })
          );
        }
        if (path.endsWith('/reclaim')) return Response.json({ patchRevision: 0 });
        if (path.endsWith('/commits') && commitFailures-- > 0)
          return new Response(null, { status: 503 });
        if (path.endsWith('/snapshot')) return new Response(null, { status: snapshotStatus });
        if (path.endsWith('/commits'))
          return Response.json({
            ...body,
            patchRevision: body.baseRevision + (body.applied ? 1 : 0)
          });

        return new Response(null, { status: 204 });
      })
    );

    coordinator = new RemoteControlSyncCoordinator({
      patchId: () => patchId,
      filesystem: vfs,
      instanceURL: 'http://patchies.test'
    });
  });

  afterEach(() => {
    coordinator.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  });

  const commits = () => requests.filter((request) => request.path.endsWith('/commits'));
  const settle = () => vi.advanceTimersByTimeAsync(200);
  const emit = (type: string, data: string, id: number) =>
    controller.enqueue(new TextEncoder().encode(`id: ${id}\nevent: ${type}\ndata: ${data}\n\n`));
  const save = async (path: string, content: string, id: number) => {
    const snapshot = requests.filter((request) => request.path.endsWith('/snapshot')).at(-1)!;
    emit(
      'operation.submitted',
      JSON.stringify({
        operationId: `op-${id}`,
        browserGeneration: snapshot.body.browserGeneration,
        baseRevision: 0,
        path,
        content
      }),
      id
    );
    await settle();
  };

  it('publishes the VFS tree and a mount command', async () => {
    await coordinator.enable();
    const snapshot = requests.find((request) => request.path.endsWith('/snapshot'))!;

    expect(
      snapshot.body.representation!.entries.filter((entry) =>
        ['objects', 'patch'].includes(entry.path.split('/')[0])
      )
    ).toEqual([
      { path: 'objects', kind: 'directory' },
      { path: 'objects/glsl-24', kind: 'directory' },
      { path: 'objects/glsl-24/shader.glsl', kind: 'file', content: 'first' },
      { path: 'patch', kind: 'directory' },
      { path: 'patch/lib', kind: 'directory' },
      { path: 'patch/lib/a.js', kind: 'file', content: 'export default 1' }
    ]);
    expect(coordinator.mountCommand).toContain('--path <new-folder-path>');
    expect(snapshot.body.representation!.entries).toContainEqual(
      expect.objectContaining({
        path: '.agents/skills/writing-patchies-object-code/SKILL.md',
        kind: 'file'
      })
    );
    expect(snapshot.body.representation!.entries).toContainEqual(
      expect.objectContaining({ path: 'references/docs/objects/glsl.md', kind: 'file' })
    );
    expect([...vfs.getAllEntries().keys()].some((path) => path.startsWith('references'))).toBe(
      false
    );
  });

  it.each([
    ['objects/glsl-24/shader.glsl', 'obj://glsl-24/shader.glsl'],
    ['patch/lib/a.js', 'patch://lib/a.js']
  ])('keeps alternating edits synchronized for %s with one commit per save', async (path, uri) => {
    await coordinator.enable();
    await save(path, 'local one', 1);
    expect(vfs.readCodeFile(uri)).toBe('local one');

    vfs.writeCodeFile(uri, 'browser two');
    await settle();
    await save(path, 'local three', 3);

    expect(vfs.readCodeFile(uri)).toBe('local three');
    expect(commits()).toHaveLength(3);
    expect(commits().map((request) => request.body.changes)).toEqual(
      ['local one', 'browser two', 'local three'].map((content) => [
        { path, entry: { path, kind: 'file', content } }
      ])
    );
    expect(commits().map((request) => request.body.baseRevision)).toEqual([0, 1, 2]);
    expect(run).toHaveBeenCalledTimes(uri.startsWith('obj://') ? 2 : 0);
  });

  it('publishes object creation, deletion, and patch file renames from VFS notifications', async () => {
    await coordinator.enable();
    objects.push({ id: 'hydra-3', type: 'hydra', data: { code: 'osc().out()' } });
    vfs.objectFiles.sync(objects);
    await settle();

    expect(commits()[0].body.changes).toContainEqual({
      path: 'objects/hydra-3/code.js',
      entry: { path: 'objects/hydra-3/code.js', kind: 'file', content: 'osc().out()' }
    });

    objects = [];
    vfs.objectFiles.sync(objects);
    vfs.renamePath('patch://lib/a.js', 'patch://lib/b.js');
    await settle();

    expect(commits()[1].body.changes).toContainEqual({
      path: 'objects/hydra-3/code.js',
      entry: null
    });
    expect(commits()[1].body.changes).toContainEqual({ path: 'patch/lib/a.js', entry: null });
    expect(commits()[1].body.changes).toContainEqual({
      path: 'patch/lib/b.js',
      entry: { path: 'patch/lib/b.js', kind: 'file', content: 'export default 1' }
    });
  });

  it('consumes invalid and rejected operations without reconnecting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await coordinator.enable();
    emit('operation.submitted', '{', 1);
    failWrite = true;
    await save('objects/glsl-24/shader.glsl', 'rejected', 2);
    expect(commits()[0].body.applied).toBe(false);
    expect(commits()[0].body.error).toContain('history rejected write');

    failWrite = false;
    await save('objects/glsl-24/shader.glsl', 'accepted', 3);
    expect(vfs.readCodeFile('obj://glsl-24/shader.glsl')).toBe('accepted');
    expect(commits()[1].body.error).toBeUndefined();
    expect(requests.filter((request) => request.path.endsWith('/browser/events'))).toHaveLength(1);
  });

  it('clears credentials when publishing the initial snapshot fails', async () => {
    snapshotStatus = 500;
    await expect(coordinator.enable()).rejects.toThrow();
    expect(coordinator.isEnabled).toBe(false);
    expect(coordinator.mountCommand).toBeNull();
  });

  it('resolves unchanged saves without marking them rejected', async () => {
    await coordinator.enable();
    await save('objects/glsl-24/shader.glsl', 'first', 1);

    expect(commits()).toHaveLength(1);
    expect(commits()[0].body.applied).toBe(false);
    expect(commits()[0].body.error).toBeUndefined();
    expect(commits()[0].body.changes).toEqual([]);
  });

  it('rejects reference writes without changing the VFS or running objects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await coordinator.enable();
    const before = [...vfs.getAllEntries()];

    await save('references/docs/objects/glsl.md', 'edited docs', 1);

    expect(commits()[0].body.error).toBeDefined();
    expect(commits()[0].body.changes).toEqual([]);
    expect([...vfs.getAllEntries()]).toEqual(before);
    expect(run).not.toHaveBeenCalled();
  });

  it('revokes the prior patch session before publishing the new patch', async () => {
    await coordinator.enable();
    patchId = 'patch-2';
    coordinator.notifyPatchChanged();
    await settle();

    const revoke = requests.findIndex(
      (request) => request.path === '/api/remote-control/sessions/session-1'
    );
    const snapshot = requests.findIndex((request) => request.path.endsWith('/session-2/snapshot'));
    expect(revoke).toBeGreaterThan(-1);
    expect(snapshot).toBeGreaterThan(revoke);
    expect(requests[snapshot].body.representation!.patchId).toBe('patch-2');
  });
  it('retains reload credentials and retries a transient snapshot failure', async () => {
    await coordinator.enable();
    coordinator.dispose();
    const saved = sessionStorage.getItem('patchies.remote-control.patch-1');
    coordinator = new RemoteControlSyncCoordinator({
      patchId: () => patchId,
      filesystem: vfs,
      instanceURL: 'http://patchies.test'
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    snapshotStatus = 503;
    const restored = coordinator.restore();
    await vi.advanceTimersByTimeAsync(100);

    expect(sessionStorage.getItem('patchies.remote-control.patch-1')).toBe(saved);
    expect(coordinator.isEnabled).toBe(true);

    snapshotStatus = 204;
    await vi.advanceTimersByTimeAsync(600);
    expect(await restored).toBe(true);
    expect(coordinator.mountCommand).toContain('patchies://v2/');
  });

  it('retries a failed commit publication without creating the node twice', async () => {
    coordinator.dispose();
    let nodes: Node[] = [];
    const history = new HistoryManager();
    const accessors = {
      getNodes: () => nodes,
      setNodes: (value: Node[]) => {
        nodes = value;
      },
      getEdges: () => [],
      setEdges: () => {}
    };
    const create = vi.fn((command) => {
      const id = `${command.name}-${nodes.length + 1}`;
      history.execute(
        new AddNodeCommand(
          { id, type: command.name, position: { x: 0, y: 0 }, data: {} },
          accessors
        )
      );
      return id;
    });
    const graph = new RemoteControlGraphService({
      accessors,
      history,
      ports: () => ({ ready: true, inlets: [], outlets: [] }),
      create,
      settle: async () => {}
    });
    coordinator = new RemoteControlSyncCoordinator({
      patchId: () => patchId,
      filesystem: vfs,
      graph,
      instanceURL: 'http://patchies.test'
    });
    await coordinator.enable();
    const snapshot = requests.find((request) => request.path.endsWith('/snapshot'))!;
    const operation = JSON.stringify({
      operationId: 'create-once',
      browserGeneration: snapshot.body.browserGeneration,
      baseRevision: 0,
      command: { kind: 'node.create', name: 'button' }
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    commitFailures = 3;
    emit('operation.submitted', operation, 1);
    await vi.advanceTimersByTimeAsync(2500);
    emit('operation.submitted', operation, 1);
    await settle();

    expect(create).toHaveBeenCalledTimes(1);
    expect(nodes.map((node) => node.id)).toEqual(['button-1']);
    expect(commits().at(-1)?.body.applied).toBe(true);
  });
});
