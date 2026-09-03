import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$workers/rendering/renderWorkerEntry?worker', () => ({
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
import { previewVisibleMap } from '../../stores/renderer.store';
import { VirtualFilesystem } from '$lib/vfs';
import { HistoryManager } from '$lib/history';

describe('GLSystem', () => {
  beforeEach(() => {
    VirtualFilesystem.resetInstance();
    HistoryManager.getInstance().clear();
  });

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

  it('treats an output override as an active video consumer', () => {
    const glSystem = new GLSystem();

    glSystem.upsertNode('canvas-dom-1', 'img', {});
    glSystem.setOverrideOutputNode('canvas-dom-1');

    expect(glSystem.hasOutgoingVideoConnections('canvas-dom-1')).toBe(true);
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

  it('clears a deleted node preview preference', () => {
    const glSystem = new GLSystem();
    const nodeId = `glsl-${crypto.randomUUID()}`;

    previewVisibleMap.set({ [nodeId]: false });
    glSystem.upsertNode(nodeId, 'glsl', { code: '', glUniformDefs: [] });
    glSystem.removeNode(nodeId);

    expect(get(previewVisibleMap)).not.toHaveProperty(nodeId);
  });

  it('refreshes direct and transitive GLSL consumers exactly once for same-length saves', () => {
    const vfs = VirtualFilesystem.getInstance();
    vfs.createEmbeddedFile(
      'patch://shaders/material.glsl',
      '#include "./math.glsl"\nfloat material() { return tone; }'
    );
    vfs.createEmbeddedFile('patch://shaders/math.glsl', 'float tone = 1.0;');

    const glSystem = new GLSystem();
    const worker = glSystem.renderWorker as unknown as { postMessage: ReturnType<typeof vi.fn> };

    glSystem.upsertNode('glsl-transitive', 'glsl', {
      code: '#include "./shaders/material.glsl"',
      glUniformDefs: []
    });
    glSystem.upsertNode('glsl-direct', 'glsl', {
      code: '#include "patch://shaders/math.glsl"',
      glUniformDefs: []
    });
    glSystem.upsertNode('glsl-unrelated', 'glsl', {
      code: 'void mainImage() {}',
      glUniformDefs: []
    });
    worker.postMessage.mockClear();

    vfs.writeEmbeddedFile('patch://shaders/math.glsl', 'float tone = 2.0;');

    const rebuilds = worker.postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === 'buildRenderGraph');

    expect(rebuilds).toHaveLength(1);
    expect(rebuilds[0].graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'glsl-transitive',
          data: expect.objectContaining({ _includeRevision: 1 })
        }),
        expect.objectContaining({
          id: 'glsl-direct',
          data: expect.objectContaining({ _includeRevision: 1 })
        }),
        expect.objectContaining({
          id: 'glsl-unrelated',
          data: expect.not.objectContaining({ _includeRevision: 1 })
        })
      ])
    );
  });
});
