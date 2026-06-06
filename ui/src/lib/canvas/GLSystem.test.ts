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
