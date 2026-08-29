import type { Node } from '@xyflow/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RemoteControlSyncCoordinator } from './sync-coordinator';

const glslNode = (code: string): Node => ({
  id: 'glsl-24',
  type: 'glsl',
  position: { x: 0, y: 0 },
  data: { code }
});

describe('RemoteControlSyncCoordinator', () => {
  const coordinators: RemoteControlSyncCoordinator[] = [];

  afterEach(() => {
    for (const coordinator of coordinators) coordinator.dispose();
    coordinators.length = 0;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  });

  it('publishes all Patchies changes as one canonical commit', async () => {
    vi.useFakeTimers();
    let nodes = [glslNode('first')];
    const relay = installRelayMock();
    const coordinator = new RemoteControlSyncCoordinator({
      patchId: () => 'patch-1',
      nodes: () => nodes,
      applyFileWrite: () => {},
      instanceURL: 'http://patchies.test'
    });
    coordinators.push(coordinator);

    await coordinator.enable();
    nodes = [glslNode('changed in Patchies')];
    coordinator.notifyPatchChanged();
    await vi.advanceTimersByTimeAsync(150);

    const commits = relay.requests.filter((request) => request.path.endsWith('/commits'));
    expect(commits).toHaveLength(1);
    expect(commits[0]).toEqual({
      path: '/api/remote-control/sessions/session-1/commits',
      body: {
        commitId: expect.any(String),
        browserGeneration: expect.any(String),
        baseRevision: 0,
        applied: true,
        changes: [
          {
            objectId: 'glsl-24',
            object: {
              id: 'glsl-24',
              metadata: {
                format: 'patchies.representation.v1',
                id: 'glsl-24',
                objectType: 'glsl',
                files: ['shader.frag']
              },
              files: { 'shader.frag': 'changed in Patchies' }
            }
          }
        ]
      }
    });
  });

  it('generates a mount command with a path placeholder', async () => {
    const coordinator = new RemoteControlSyncCoordinator({
      patchId: () => 'patch-1',
      nodes: () => [],
      applyFileWrite: () => {},
      instanceURL: 'http://patchies.test'
    });
    coordinators.push(coordinator);

    installRelayMock();
    await coordinator.enable();

    expect(coordinator.mountCommand).toMatch(/^patchies mount --token patchies:\/\/v2\//);
    expect(coordinator.mountCommand).toContain('--path <new-folder-path>');
  });

  it('applies a filesystem operation through history and publishes the same commit path', async () => {
    let nodes = [glslNode('first')];
    const relay = installRelayMock();
    const applyFileWrite = vi.fn((write) => {
      nodes = nodes.map((node) =>
        node.id === write.nodeId
          ? { ...node, data: { ...node.data, [write.dataKey]: write.newValue } }
          : node
      );
    });
    const coordinator = new RemoteControlSyncCoordinator({
      patchId: () => 'patch-1',
      nodes: () => nodes,
      applyFileWrite,
      instanceURL: 'http://patchies.test'
    });
    coordinators.push(coordinator);

    await coordinator.enable();
    await submitFilesystemOperation(relay, 'operation-1', 'changed from filesystem', 1);

    expect(applyFileWrite).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'glsl-24', newValue: 'changed from filesystem' })
    );
    expect(nodes[0]?.data.code).toBe('changed from filesystem');
    expect(relay.requests.filter((request) => request.path.endsWith('/commits'))).toEqual([
      {
        path: '/api/remote-control/sessions/session-1/commits',
        body: expect.objectContaining({
          operationId: 'operation-1',
          baseRevision: 0,
          applied: true,
          changes: [expect.objectContaining({ objectId: 'glsl-24' })]
        })
      }
    ]);
  });

  it('keeps alternating filesystem and Patchies edits synchronized', async () => {
    vi.useFakeTimers();
    let nodes = [glslNode('first')];
    const relay = installRelayMock();
    const coordinator = new RemoteControlSyncCoordinator({
      patchId: () => 'patch-1',
      nodes: () => nodes,
      applyFileWrite: (write) => {
        nodes = nodes.map((node) =>
          node.id === write.nodeId
            ? { ...node, data: { ...node.data, [write.dataKey]: write.newValue } }
            : node
        );
        coordinator.notifyPatchChanged();
      },
      instanceURL: 'http://patchies.test'
    });
    coordinators.push(coordinator);

    await coordinator.enable();
    await submitFilesystemOperation(relay, 'operation-1', 'filesystem one', 1);
    await vi.advanceTimersByTimeAsync(150);

    nodes = [glslNode('Patchies two')];
    coordinator.notifyPatchChanged();
    await vi.advanceTimersByTimeAsync(150);

    await submitFilesystemOperation(relay, 'operation-3', 'filesystem three', 3);
    await vi.advanceTimersByTimeAsync(150);

    const commits = relay.requests
      .filter((request) => request.path.endsWith('/commits'))
      .map((request) => request.body as { operationId?: string; baseRevision: number });
    expect(commits).toHaveLength(3);
    expect(commits.map((commit) => commit.operationId ?? 'browser')).toEqual([
      'operation-1',
      'browser',
      'operation-3'
    ]);
    expect(commits.map((commit) => commit.baseRevision)).toEqual([0, 1, 2]);
  });

  it('clears a partially enabled session when snapshot publication fails', async () => {
    const coordinator = new RemoteControlSyncCoordinator({
      patchId: () => 'patch-1',
      nodes: () => [glslNode('first')],
      applyFileWrite: () => {},
      instanceURL: 'http://patchies.test'
    });
    coordinators.push(coordinator);

    installRelayMock({ snapshotStatus: 500 });

    await expect(coordinator.enable()).rejects.toThrow('Remote control request failed: 500');

    expect(coordinator.isEnabled).toBe(false);
    expect(coordinator.mountCommand).toBeNull();
  });

  it('consumes a malformed operation and continues on the same event stream', async () => {
    let nodes = [glslNode('first')];
    const relay = installRelayMock();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const coordinator = new RemoteControlSyncCoordinator({
      patchId: () => 'patch-1',
      nodes: () => nodes,
      applyFileWrite: (write) => {
        nodes = nodes.map((node) =>
          node.id === write.nodeId
            ? { ...node, data: { ...node.data, [write.dataKey]: write.newValue } }
            : node
        );
      },
      instanceURL: 'http://patchies.test'
    });
    coordinators.push(coordinator);

    await coordinator.enable();
    relay.emitRawEvent('operation.submitted', '{', 1);
    relay.emitOperation(
      {
        operationId: 'operation-2',
        baseRevision: 0,
        path: 'glsl-24/shader.frag',
        content: 'valid after malformed'
      },
      2
    );
    await eventually(() => nodes[0]?.data.code === 'valid after malformed');

    expect(consoleError).toHaveBeenCalledWith(
      'Remote Control received an invalid operation',
      expect.anything()
    );
    expect(
      relay.requests.filter((request) => request.path.endsWith('/browser/events'))
    ).toHaveLength(1);
  });

  it('consumes a failed operation and continues on the same event stream', async () => {
    let nodes = [glslNode('first')];
    let failNextWrite = true;
    const relay = installRelayMock();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const coordinator = new RemoteControlSyncCoordinator({
      patchId: () => 'patch-1',
      nodes: () => nodes,
      applyFileWrite: (write) => {
        if (failNextWrite) {
          failNextWrite = false;
          throw new Error('history rejected write');
        }

        nodes = nodes.map((node) =>
          node.id === write.nodeId
            ? { ...node, data: { ...node.data, [write.dataKey]: write.newValue } }
            : node
        );
      },
      instanceURL: 'http://patchies.test'
    });
    coordinators.push(coordinator);

    await coordinator.enable();
    relay.emitOperation(
      {
        operationId: 'operation-1',
        baseRevision: 0,
        path: 'glsl-24/shader.frag',
        content: 'rejected'
      },
      1
    );
    relay.emitOperation(
      {
        operationId: 'operation-2',
        baseRevision: 0,
        path: 'glsl-24/shader.frag',
        content: 'valid after failure'
      },
      2
    );
    await eventually(() => nodes[0]?.data.code === 'valid after failure');

    expect(consoleError).toHaveBeenCalledWith(
      'Remote Control could not resolve operation operation-1',
      expect.anything()
    );
    expect(
      relay.requests.filter((request) => request.path.endsWith('/browser/events'))
    ).toHaveLength(1);
  });

  it('revokes the old session before enabling remote control for a new patch', async () => {
    let patchId = 'patch-1';
    const relay = installRelayMock();
    const coordinator = new RemoteControlSyncCoordinator({
      patchId: () => patchId,
      nodes: () => [glslNode(patchId)],
      applyFileWrite: () => {},
      instanceURL: 'http://patchies.test'
    });
    coordinators.push(coordinator);

    await coordinator.enable();
    patchId = 'patch-2';
    coordinator.notifyPatchChanged([glslNode('patch-2')], patchId);
    await eventually(() =>
      relay.requests.some(
        (request) => request.path === '/api/remote-control/sessions/session-2/snapshot'
      )
    );

    const oldRevoke = relay.requests.findIndex(
      (request) => request.path === '/api/remote-control/sessions/session-1'
    );
    const newSession = relay.requests.findIndex(
      (request, index) => index > oldRevoke && request.path === '/api/remote-control/sessions'
    );
    const snapshots = relay.requests.filter((request) => request.path.endsWith('/snapshot'));

    expect(oldRevoke).toBeGreaterThan(-1);
    expect(newSession).toBeGreaterThan(oldRevoke);
    expect(snapshots.at(-1)?.path).toBe('/api/remote-control/sessions/session-2/snapshot');
    expect(snapshots.at(-1)?.body).toEqual(
      expect.objectContaining({
        representation: expect.objectContaining({ patchId: 'patch-2' })
      })
    );
    expect(coordinator.isEnabled).toBe(true);
  });
});

interface RelayRequest {
  path: string;
  body: unknown;
}

interface RelayMock {
  emitOperation: (operation: Omit<OperationRequest, 'browserGeneration'>, eventId: number) => void;
  emitRawEvent: (type: string, data: string, eventId: number) => void;
  requests: RelayRequest[];
}

interface OperationRequest {
  operationId: string;
  browserGeneration: string;
  baseRevision: number;
  path: string;
  content: string;
}

const installRelayMock = (options: { snapshotStatus?: number } = {}): RelayMock => {
  const requests: RelayRequest[] = [];
  let sessionCount = 0;
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ path: url.pathname, body });

      if (url.pathname === '/api/remote-control/sessions') {
        sessionCount++;
        return Response.json({
          sessionId: `session-${sessionCount}`,
          secret: `secret-${sessionCount}`
        });
      }
      if (url.pathname.endsWith('/snapshot') && options.snapshotStatus) {
        return Response.json({ code: 'snapshot_failed' }, { status: options.snapshotStatus });
      }
      if (url.pathname.endsWith('/browser/events')) {
        return new Response(
          new ReadableStream({
            start(controller) {
              streamController = controller;
            }
          })
        );
      }
      if (url.pathname.endsWith('/commits')) {
        return Response.json({
          ...body,
          patchRevision: body.applied ? body.baseRevision + 1 : body.baseRevision
        });
      }

      return new Response(null, { status: 204 });
    })
  );

  return {
    requests,
    emitRawEvent(type, data, eventId) {
      if (!streamController) throw new Error('browser event stream is not ready');

      streamController.enqueue(
        new TextEncoder().encode(`id: ${eventId}\nevent: ${type}\ndata: ${data}\n\n`)
      );
    },
    emitOperation(operation, eventId) {
      const snapshot = requests.filter((request) => request.path.endsWith('/snapshot')).at(-1);
      const browserGeneration = (snapshot?.body as { browserGeneration?: string } | undefined)
        ?.browserGeneration;
      if (!browserGeneration || !streamController)
        throw new Error('browser event stream is not ready');

      streamController.enqueue(
        new TextEncoder().encode(
          `id: ${eventId}\nevent: operation.submitted\ndata: ${JSON.stringify({
            ...operation,
            browserGeneration
          })}\n\n`
        )
      );
    }
  };
};

const submitFilesystemOperation = async (
  relay: RelayMock,
  operationId: string,
  content: string,
  eventId: number
): Promise<void> => {
  relay.emitOperation(
    {
      operationId,
      baseRevision: 0,
      path: 'glsl-24/shader.frag',
      content
    },
    eventId
  );

  for (let attempt = 0; attempt < 10; attempt++) await Promise.resolve();
};

const eventually = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (predicate()) return;

    await Promise.resolve();
  }

  throw new Error('condition was not satisfied');
};
