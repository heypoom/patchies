import { describe, expect, it, vi } from 'vitest';

vi.mock('$workers/rendering/renderWorker?worker', () => ({
  default: class RenderWorkerMock {
    addEventListener = vi.fn();
    postMessage = vi.fn();
  }
}));

vi.mock('$lib/audio/AudioAnalysisSystem', () => ({
  AudioAnalysisSystem: {
    getInstance: () => ({ onFFTDataReady: null, disableFFT: vi.fn() })
  }
}));

vi.mock('./IpcSystem', () => ({
  IpcSystem: {
    getInstance: () => ({ outputWindow: null })
  }
}));

import { GLSystem } from './GLSystem';
import { VideoChannelRegistry } from './VideoChannelRegistry';

describe('GLSystem', () => {
  it('sends connected video output node ids with render graph updates', () => {
    const glSystem = new GLSystem();
    const worker = glSystem.renderWorker as unknown as { postMessage: ReturnType<typeof vi.fn> };

    glSystem.upsertNode('glsl-1', 'glsl', { code: '', glUniformDefs: [] });
    worker.postMessage.mockClear();

    glSystem.registerPatchbayVideoEdge('edge-1', {
      id: 'edge-1',
      source: 'glsl-1',
      target: 'worker-1',
      sourceHandle: 'video-out',
      targetHandle: 'video-in-0'
    });

    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'buildRenderGraph',
        connectedVideoOutputNodeIds: ['glsl-1']
      })
    );
  });

  it('does not send internal FBO video edges as external output node ids', () => {
    const glSystem = new GLSystem();
    const worker = glSystem.renderWorker as unknown as { postMessage: ReturnType<typeof vi.fn> };

    glSystem.upsertNode('hydra-1', 'hydra', { code: '' });
    glSystem.upsertNode('glsl-1', 'glsl', { code: '', glUniformDefs: [] });
    worker.postMessage.mockClear();

    glSystem.updateEdges([
      {
        id: 'edge-1',
        source: 'hydra-1',
        target: 'glsl-1',
        sourceHandle: 'video-out',
        targetHandle: 'video-in-0'
      }
    ]);

    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'buildRenderGraph',
        connectedVideoOutputNodeIds: []
      })
    );
  });

  it('does not resubscribe unchanged video channel nodes', () => {
    const glSystem = new GLSystem();
    const registry = VideoChannelRegistry.getInstance();
    const channel = `stable-video-${crypto.randomUUID()}`;
    const nodeId = `recv-video-${crypto.randomUUID()}`;
    let channelChangeCount = 0;
    const unsubscribe = registry.onChannelsChange(() => {
      channelChangeCount += 1;
    });

    glSystem.upsertNode(nodeId, 'recv.vdo', { channel });
    glSystem.upsertNode(nodeId, 'recv.vdo', { channel });

    expect(channelChangeCount).toBe(1);

    unsubscribe();
    glSystem.removeNode(nodeId);
  });
});
