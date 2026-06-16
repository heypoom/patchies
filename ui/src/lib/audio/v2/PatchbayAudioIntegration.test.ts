import type { Edge } from '@xyflow/svelte';
import { describe, expect, it, vi } from 'vitest';

import { PatchbayAudioIntegration } from './PatchbayAudioIntegration';

import type { AudioNodeV2 } from './interfaces/audio-nodes';

describe('PatchbayAudioIntegration', () => {
  it('stores patchbay audio edges and notifies when they change', () => {
    const onEdgesChanged = vi.fn();

    const integration = new PatchbayAudioIntegration({
      getAudioContext: () => ({ createGain: vi.fn() }) as unknown as AudioContext,
      nodesById: new Map(),
      removeNodeById: vi.fn(),
      onEdgesChanged
    });

    const edge: Edge = { id: 'edge-1', source: 'a', target: 'b' };

    integration.registerEdge('route-1', edge);
    expect(integration.getEdges()).toEqual([edge]);
    expect(onEdgesChanged).toHaveBeenCalledTimes(1);

    integration.unregisterEdge('route-1');
    expect(integration.getEdges()).toEqual([]);
    expect(onEdgesChanged).toHaveBeenCalledTimes(2);
  });

  it('creates and cleans up synthetic patchbay endpoint nodes', () => {
    const disconnect = vi.fn();
    const gain = { gain: { value: 0 }, disconnect };
    const nodesById = new Map();

    const removeNodeById = vi.fn((nodeId: string) => {
      nodesById.get(nodeId)?.destroy?.();
      nodesById.delete(nodeId);
    });

    const integration = new PatchbayAudioIntegration({
      getAudioContext: () => ({ createGain: () => gain }) as unknown as AudioContext,
      nodesById,
      removeNodeById,
      onEdgesChanged: vi.fn()
    });

    const endpointId = 'patchbay:audio-recv:Source:audio-send:Target';
    integration.ensureEndpoint(endpointId);

    expect(nodesById.has(endpointId)).toBe(true);

    integration.cleanupStaleEndpoints([]);

    expect(removeNodeById).toHaveBeenCalledWith(endpointId);
    expect(nodesById.has(endpointId)).toBe(false);
    expect(disconnect).toHaveBeenCalled();
  });

  it('cleans up a virtual expr node when it is unregistered before async creation finishes', async () => {
    let finishCreate!: () => void;
    const destroy = vi.fn();
    const node: AudioNodeV2 = {
      nodeId: 'patchbay:audio-expr:inline:gain',
      audioNode: null,
      create: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishCreate = () => {
              node.audioNode = { disconnect: vi.fn() } as unknown as AudioNode;
              resolve();
            };
          })
      ),
      destroy
    };
    const nodesById = new Map<string, AudioNodeV2>();

    const integration = new PatchbayAudioIntegration({
      getAudioContext: () => ({}) as unknown as AudioContext,
      nodesById,
      removeNodeById(nodeId) {
        nodesById.get(nodeId)?.destroy?.();
        nodesById.delete(nodeId);
      },
      onEdgesChanged: vi.fn(),
      createVirtualExpressionNode: () => node
    });

    integration.registerVirtualExpression('route-1', {
      nodeId: node.nodeId,
      expression: 's * 0.1'
    });
    integration.unregisterVirtualExpression('route-1');

    expect(nodesById.has(node.nodeId)).toBe(false);
    expect(destroy).toHaveBeenCalledTimes(1);

    finishCreate();
    await Promise.resolve();

    expect(nodesById.has(node.nodeId)).toBe(false);
    expect(destroy).toHaveBeenCalledTimes(2);
  });
});
