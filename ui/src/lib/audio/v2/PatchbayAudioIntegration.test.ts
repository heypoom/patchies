import type { Edge } from '@xyflow/svelte';
import { describe, expect, it, vi } from 'vitest';

import { PatchbayAudioIntegration } from './PatchbayAudioIntegration';

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
});
