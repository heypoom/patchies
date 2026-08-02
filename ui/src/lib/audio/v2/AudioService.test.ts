import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./nodes', () => ({
  registerAudioNodes: vi.fn()
}));

import { AudioService } from './AudioService';
import type { AudioNodeClass, AudioNodeV2 } from './interfaces/audio-nodes';
import { logger } from '$lib/utils/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

function registerFakeNode(service: AudioService, node: AudioNodeV2): void {
  (
    service as unknown as {
      nodesById: Map<string, AudioNodeV2>;
    }
  ).nodesById.set(node.nodeId, node);
}

function setFakeAudioContext(service: AudioService): void {
  (service as unknown as { audioContext: AudioContext }).audioContext = {} as AudioContext;
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

  it('disposes a node superseded while beforeCreate is pending', async () => {
    const service = new AudioService();
    setFakeAudioContext(service);
    const nodeId = 'superseded-node';
    const replacement: AudioNodeV2 = { nodeId, audioNode: null };
    const destroy = vi.fn();

    class SupersededNode implements AudioNodeV2 {
      static type = 'audio-service-superseded-test';
      static group = 'processors' as const;
      audioNode = null;
      nodeId = nodeId;
      destroy = destroy;
    }

    service.registry.register(SupersededNode as AudioNodeClass);
    const connectPendingEdges = vi.spyOn(
      service as unknown as { connectPendingEdges: (id: string) => void },
      'connectPendingEdges'
    );

    const created = await service.createNode(nodeId, SupersededNode.type, [], async () => {
      registerFakeNode(service, replacement);
    });

    expect(created).toBeNull();
    expect(destroy).toHaveBeenCalledOnce();
    expect(service.getNodeById(nodeId)).toBe(replacement);
    expect(connectPendingEdges).not.toHaveBeenCalled();
  });

  it('disposes a node when initialization fails', async () => {
    const service = new AudioService();
    setFakeAudioContext(service);
    const destroy = vi.fn();

    class FailingNode implements AudioNodeV2 {
      static type = 'audio-service-failing-test';
      static group = 'processors' as const;
      audioNode = null;
      nodeId = 'failing-node';
      destroy = destroy;
      create = vi.fn(async () => {
        throw new Error('create failed');
      });
    }

    service.registry.register(FailingNode as AudioNodeClass);
    const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    await expect(service.createNode('failing-node', FailingNode.type)).resolves.toBeNull();

    expect(error).toHaveBeenCalledWith(`cannot create node ${FailingNode.type}`, expect.any(Error));
    expect(destroy).toHaveBeenCalledOnce();
    expect(service.getNodeById('failing-node')).toBeNull();
  });
});
