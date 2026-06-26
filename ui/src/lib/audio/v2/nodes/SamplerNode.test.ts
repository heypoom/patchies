import { describe, expect, it, vi } from 'vitest';

import { SamplerNode } from './SamplerNode';

function createFakeSource() {
  return {
    buffer: null as AudioBuffer | null,
    playbackRate: { value: 1 },
    detune: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null
  };
}

function createFakeAudioContext(sources = [createFakeSource()]) {
  let sourceIndex = 0;

  return {
    currentTime: 0,
    createGain: () => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn()
    }),
    createMediaStreamDestination: () => ({
      stream: {} as MediaStream,
      disconnect: vi.fn()
    }),
    createBufferSource: () => sources[sourceIndex++] ?? createFakeSource()
  } as unknown as AudioContext;
}

describe('SamplerNode', () => {
  it('schedules bang messages with time', () => {
    const source = createFakeSource();
    const audioContext = createFakeAudioContext([source]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'bang', time: 12.5 });

    expect(source.start).toHaveBeenCalledWith(12.5, 0, undefined);
  });

  it('schedules play messages with time, offset, and duration', () => {
    const source = createFakeSource();
    const audioContext = createFakeAudioContext([source]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'play', time: 12.5, offset: 0.25, duration: 1.5 });

    expect(source.start).toHaveBeenCalledWith(12.5, 0.25, 1.5);
  });

  it('allows future scheduled plays to coexist', () => {
    const first = createFakeSource();
    const second = createFakeSource();
    const audioContext = createFakeAudioContext([first, second]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'bang', time: 12.5 });
    node.send('message', { type: 'bang', time: 12.75 });

    expect(first.stop).not.toHaveBeenCalled();
    expect(second.stop).not.toHaveBeenCalled();
  });

  it('restarts immediate playback', () => {
    const first = createFakeSource();
    const second = createFakeSource();
    const audioContext = createFakeAudioContext([first, second]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'bang' });
    node.send('message', { type: 'bang' });

    expect(first.stop).toHaveBeenCalledOnce();
    expect(second.stop).not.toHaveBeenCalled();
  });
});
