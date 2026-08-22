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
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  });

  it('publishes all Patchies changes as one canonical commit', async () => {
    vi.useFakeTimers();
    let nodes = [glslNode('first')];
    const requests = installRelayMock();
    const coordinator = new RemoteControlSyncCoordinator({
      patchId: () => 'patch-1',
      nodes: () => nodes,
      applyFileWrite: () => {},
      instanceURL: 'http://patchies.test'
    });

    await coordinator.enable();
    nodes = [glslNode('changed in Patchies')];
    coordinator.notifyPatchChanged();
    await vi.advanceTimersByTimeAsync(150);

    const commits = requests.filter((request) => request.path.endsWith('/commits'));
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

    installRelayMock();
    await coordinator.enable();

    expect(coordinator.mountCommand).toMatch(/^patchies mount --token patchies:\/\/v2\//);
    expect(coordinator.mountCommand).toContain('--path <new-folder-path>');
  });

  it('applies a filesystem operation through history and publishes the same commit path', async () => {
    let nodes = [glslNode('first')];
    const requests = installRelayMock();
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

    await coordinator.enable();
    await submitFilesystemOperation(coordinator, 'operation-1', 'changed from filesystem', 1);

    expect(applyFileWrite).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'glsl-24', newValue: 'changed from filesystem' })
    );
    expect(nodes[0]?.data.code).toBe('changed from filesystem');
    expect(requests.filter((request) => request.path.endsWith('/commits'))).toEqual([
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
    const requests = installRelayMock();
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

    await coordinator.enable();
    await submitFilesystemOperation(coordinator, 'operation-1', 'filesystem one', 1);
    await vi.advanceTimersByTimeAsync(150);

    nodes = [glslNode('Patchies two')];
    coordinator.notifyPatchChanged();
    await vi.advanceTimersByTimeAsync(150);

    await submitFilesystemOperation(coordinator, 'operation-3', 'filesystem three', 3);
    await vi.advanceTimersByTimeAsync(150);

    const commits = requests
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
});

interface RelayRequest {
  path: string;
  body: unknown;
}

const installRelayMock = (): RelayRequest[] => {
  const requests: RelayRequest[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ path: url.pathname, body });

      if (url.pathname === '/api/remote-control/sessions') {
        return Response.json({ sessionId: 'session-1', secret: 'secret-1' });
      }
      if (url.pathname.endsWith('/browser/events')) {
        return new Response(new ReadableStream());
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

  return requests;
};

const submitFilesystemOperation = async (
  coordinator: RemoteControlSyncCoordinator,
  operationId: string,
  content: string,
  eventId: number
): Promise<void> => {
  const browserGeneration = (coordinator as unknown as { browserGeneration: string })
    .browserGeneration;

  await (
    coordinator as unknown as { handleSSEEvent: (event: string) => Promise<void> }
  ).handleSSEEvent(
    `id: ${eventId}\nevent: operation.submitted\ndata: ${JSON.stringify({
      operationId,
      browserGeneration,
      baseRevision: 0,
      path: 'glsl-24/shader.frag',
      content
    })}`
  );
};
