import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/browser/BrowserFocusService', () => ({
  BrowserFocusService: {
    getInstance: () => ({
      isWindowFocused: true,
      isDocumentVisible: true,
      onFocusChange: () => () => {}
    })
  }
}));

import { MessageChannelRegistry } from '$lib/messages/MessageChannelRegistry';
import { MessageSystem } from '$lib/messages/MessageSystem';

import { AudioAnalysisSystem } from './AudioAnalysisSystem';

const channel = 'fft-analysis-channel-test';
const fftNodeId = 'object-fft-analysis-source';
const sendNodeId = 'object-fft-analysis-send';
const recvNodeId = 'object-fft-analysis-recv';
const consumerNodeId = 'p5-fft-analysis-consumer';

class FakeFFTNode {
  static type = 'fft~';

  audioNode = {
    fftSize: 4,
    getByteTimeDomainData: (array: Uint8Array) => array.set([11, 22, 33, 44]),
    getFloatTimeDomainData: () => {},
    getByteFrequencyData: () => {},
    getFloatFrequencyData: () => {}
  };
}

afterEach(() => {
  const registry = MessageChannelRegistry.getInstance();
  registry.unregisterSender(channel, sendNodeId);
  registry.unsubscribe(channel, recvNodeId);

  MessageSystem.getInstance().updateEdges([]);
});

interface MockAnalysisSystem {
  audioService: { getNodeById: (nodeId: string) => unknown };
}

function createAnalysisSystem(): AudioAnalysisSystem {
  const system = new AudioAnalysisSystem();
  const fftNode = new FakeFFTNode();

  (system as unknown as MockAnalysisSystem).audioService = {
    getNodeById: (nodeId) => (nodeId === fftNodeId ? fftNode : null)
  };

  return system;
}

function connectFFTThroughChannel(): void {
  const registry = MessageChannelRegistry.getInstance();
  registry.registerSender(channel, sendNodeId);
  registry.subscribe(channel, recvNodeId, () => {});

  connectFFTChannelEdges();
}

function connectFFTChannelEdges(): void {
  MessageSystem.getInstance().updateEdges([
    {
      id: 'fft-to-send',
      source: fftNodeId,
      sourceHandle: 'analysis-out-0',
      target: sendNodeId,
      targetHandle: 'message-in-0'
    },
    {
      id: 'recv-to-consumer',
      source: recvNodeId,
      sourceHandle: 'message-out-0',
      target: consumerNodeId,
      targetHandle: 'message-in-0'
    }
  ]);
}

describe('AudioAnalysisSystem', () => {
  it('resolves fft analysis through a send and recv channel', () => {
    connectFFTThroughChannel();

    const analysis = createAnalysisSystem().getAnalysisForNode(consumerNodeId);
    expect(analysis).toEqual(new Uint8Array([11, 22, 33, 44]));
  });

  it('resolves a channel after its sender and receiver register', () => {
    connectFFTChannelEdges();

    const system = createAnalysisSystem();
    expect(system.getAnalysisForNode(consumerNodeId)).toBeNull();

    const registry = MessageChannelRegistry.getInstance();
    registry.registerSender(channel, sendNodeId);
    registry.subscribe(channel, recvNodeId, () => {});

    expect(system.getAnalysisForNode(consumerNodeId)).toEqual(new Uint8Array([11, 22, 33, 44]));
  });
});
