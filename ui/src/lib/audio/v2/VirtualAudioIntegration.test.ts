import type { Edge } from '@xyflow/svelte';
import { describe, expect, it, vi } from 'vitest';

import { VirtualAudioIntegration } from './VirtualAudioIntegration';

import type { AudioNodeV2 } from './interfaces/audio-nodes';

describe('VirtualAudioIntegration', () => {
  it('stores patchbay audio edges and notifies when they change', () => {
    const onEdgesChanged = vi.fn();

    const integration = new VirtualAudioIntegration({
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

    const integration = new VirtualAudioIntegration({
      getAudioContext: () => ({ createGain: () => gain }) as unknown as AudioContext,
      nodesById,
      removeNodeById,
      onEdgesChanged: vi.fn(),
      createVirtualAudioNode: (nodeId) =>
        ({
          nodeId,
          audioNode: gain as unknown as AudioNode,
          destroy: disconnect
        }) as AudioNodeV2
    });

    const endpointId = 'patchbay:audio-recv:Source:audio-send:Target';
    integration.ensureEndpoint(endpointId);

    expect(nodesById.has(endpointId)).toBe(true);

    integration.cleanupStaleEndpoints([]);

    expect(removeNodeById).toHaveBeenCalledWith(endpointId);
    expect(nodesById.has(endpointId)).toBe(false);
    expect(disconnect).toHaveBeenCalled();
  });

  it('cleans up a virtual audio node when it is unregistered before async creation finishes', async () => {
    let finishCreate!: () => void;
    const destroy = vi.fn();
    const node: AudioNodeV2 = {
      nodeId: 'patchbay:audio-virtual:inline:gain',
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

    const integration = new VirtualAudioIntegration({
      getAudioContext: () => ({}) as unknown as AudioContext,
      nodesById,
      removeNodeById(nodeId) {
        nodesById.get(nodeId)?.destroy?.();
        nodesById.delete(nodeId);
      },
      onEdgesChanged: vi.fn(),
      createVirtualAudioNode: () => node
    });

    integration.registerVirtualAudioNode('route-1', {
      nodeId: node.nodeId,
      type: 'expr~',
      params: [null, 's * 0.1']
    });
    integration.unregisterVirtualAudioNode('route-1');

    expect(nodesById.has(node.nodeId)).toBe(false);
    expect(destroy).toHaveBeenCalledTimes(1);

    finishCreate();
    await Promise.resolve();

    expect(nodesById.has(node.nodeId)).toBe(false);
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  it('creates whitelisted virtual audio nodes with parsed params', async () => {
    const create = vi.fn();
    const node: AudioNodeV2 = {
      nodeId: 'patchbay:audio-virtual:Filter',
      audioNode: null,
      create
    };
    const nodesById = new Map<string, AudioNodeV2>();

    const integration = new VirtualAudioIntegration({
      getAudioContext: () => ({}) as unknown as AudioContext,
      nodesById,
      removeNodeById(nodeId) {
        nodesById.delete(nodeId);
      },
      onEdgesChanged: vi.fn(),
      createVirtualAudioNode: (_nodeId, type) => {
        expect(type).toBe('lowpass~');
        return node;
      }
    });

    integration.registerVirtualAudioNode('route-1', {
      nodeId: node.nodeId,
      type: 'lowpass~',
      params: [null, 1000, 1]
    });

    await Promise.resolve();

    expect(nodesById.get(node.nodeId)).toBe(node);
    expect(create).toHaveBeenCalledWith([null, 1000, 1]);
  });
});
