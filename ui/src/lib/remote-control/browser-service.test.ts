import type { Node } from '@xyflow/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserRemoteControlService } from './browser-service';

const glslNode = (code: string): Node => ({
  id: 'glsl-24',
  type: 'glsl',
  position: { x: 0, y: 0 },
  data: { code }
});

describe('BrowserRemoteControlService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('publishes a changed Patchies code editor object to the mounted client', async () => {
    vi.useFakeTimers();
    let nodes = [glslNode('first')];
    const requests: Array<{ path: string; body: unknown }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = new URL(input);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        requests.push({ path: url.pathname, body });

        if (url.pathname === '/api/remote-control/sessions') {
          return Response.json({ sessionId: 'session-1', secret: 'secret-1' });
        }
        if (url.pathname.endsWith('/browser/events')) {
          return new Response(new ReadableStream());
        }

        return new Response(null, { status: 204 });
      })
    );

    const service = new BrowserRemoteControlService({
      patchId: () => 'patch-1',
      nodes: () => nodes,
      applyFileWrite: () => {},
      instanceURL: 'http://patchies.test'
    });

    await service.enable();
    nodes = [glslNode('changed in Patchies')];
    service.scheduleCurrentPatchSync();
    await vi.advanceTimersByTimeAsync(150);

    expect(requests).toContainEqual({
      path: '/api/remote-control/sessions/session-1/objects/glsl-24',
      body: {
        browserGeneration: expect.any(String),
        patchRevision: 1,
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
    });
  });

  it('applies a mounted file save to the Patchies object before acknowledging it', async () => {
    let nodes = [glslNode('first')];
    const requests: Array<{ path: string; body: unknown }> = [];
    const applyFileWrite = vi.fn((write) => {
      nodes = nodes.map((node) =>
        node.id === write.nodeId
          ? { ...node, data: { ...node.data, [write.dataKey]: write.newValue } }
          : node
      );
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = new URL(input);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        requests.push({ path: url.pathname, body });

        if (url.pathname === '/api/remote-control/sessions') {
          return Response.json({ sessionId: 'session-1', secret: 'secret-1' });
        }
        if (url.pathname.endsWith('/browser/events')) {
          return new Response(new ReadableStream());
        }

        return new Response(null, { status: 204 });
      })
    );

    const service = new BrowserRemoteControlService({
      patchId: () => 'patch-1',
      nodes: () => nodes,
      applyFileWrite,
      instanceURL: 'http://patchies.test'
    });

    await service.enable();
    await (
      service as unknown as { handleSSEEvent: (event: string) => Promise<void> }
    ).handleSSEEvent(
      `event: operation.submitted\ndata: ${JSON.stringify({
        operationId: 'operation-1',
        browserGeneration: 'browser-1',
        patchRevision: 0,
        path: 'glsl-24/shader.frag',
        content: 'changed from filesystem'
      })}`
    );

    expect(applyFileWrite).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'glsl-24', newValue: 'changed from filesystem' })
    );
    expect(nodes[0]?.data.code).toBe('changed from filesystem');
    expect(requests).toContainEqual({
      path: '/api/remote-control/sessions/session-1/operations/operation-1/ack',
      body: expect.objectContaining({ applied: true, objectId: 'glsl-24', patchRevision: 1 })
    });
  });
});
