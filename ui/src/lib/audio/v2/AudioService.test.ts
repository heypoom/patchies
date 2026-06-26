import { describe, expect, it, vi } from 'vitest';

vi.mock('./nodes', () => ({
  registerAudioNodes: vi.fn()
}));

import { AudioService } from './AudioService';
import type { AudioNodeV2 } from './interfaces/audio-nodes';

function registerFakeNode(service: AudioService, node: AudioNodeV2): void {
  (
    service as unknown as {
      nodesById: Map<string, AudioNodeV2>;
    }
  ).nodesById.set(node.nodeId, node);
}

describe('AudioService', () => {
  it('forwards scheduled messages to node send when no AudioParam handles the key', () => {
    const service = new AudioService();
    const node: AudioNodeV2 = {
      nodeId: 'node-1',
      audioNode: null,
      send: vi.fn()
    };
    const message = { type: 'set', time: 12.5, value: 0.75 };

    registerFakeNode(service, node);
    service.send(node.nodeId, 'message', message);

    expect(node.send).toHaveBeenCalledWith('message', message);
  });

  it('forwards scheduled messages to node send when scheduler has not started', () => {
    const service = new AudioService();
    const audioParam = { value: 0 } as AudioParam;
    const node: AudioNodeV2 = {
      nodeId: 'node-1',
      audioNode: null,
      send: vi.fn(),
      getAudioParam: () => audioParam
    };
    const message = { type: 'set', time: 12.5, value: 0.75 };

    registerFakeNode(service, node);
    service.send(node.nodeId, 'gain', message);

    expect(node.send).toHaveBeenCalledWith('gain', message);
  });
});
