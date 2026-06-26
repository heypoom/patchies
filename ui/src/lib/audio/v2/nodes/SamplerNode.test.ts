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

function createFakeGain() {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn()
  };
}

function createFakeAudioContext(sources = [createFakeSource()], gains = [createFakeGain()]) {
  let sourceIndex = 0;
  let gainIndex = 0;

  return {
    currentTime: 0,
    createGain: () => gains[gainIndex++] ?? createFakeGain(),
    createMediaStreamDestination: () => ({
      stream: {} as MediaStream,
      disconnect: vi.fn()
    }),
    createBufferSource: () => sources[sourceIndex++] ?? createFakeSource()
  } as unknown as AudioContext;
}

describe('SamplerNode', () => {
  it('plays number messages as gain-scaled triggers', () => {
    const source = createFakeSource();
    const outputGain = createFakeGain();
    const voiceGain = createFakeGain();
    const audioContext = createFakeAudioContext([source], [outputGain, voiceGain]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', 2);

    expect(voiceGain.gain.value).toBe(2);
    expect(source.connect).toHaveBeenCalledWith(voiceGain);
    expect(voiceGain.connect).toHaveBeenCalledWith(node.audioNode);
    expect(source.start).toHaveBeenCalledWith(0, 0, undefined);
  });

  it('ignores invalid number messages', () => {
    const source = createFakeSource();
    const audioContext = createFakeAudioContext([source]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', -1);
    node.send('message', Number.NaN);

    expect(source.start).not.toHaveBeenCalled();
  });

  it('sets built-in output gain', () => {
    const outputGain = createFakeGain();
    const audioContext = createFakeAudioContext([], [outputGain]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.send('message', { type: 'setGain', value: 0.25 });

    expect(node.audioNode.gain.value).toBe(0.25);
  });

  it('plays scheduled set messages as gain-scaled triggers', () => {
    const source = createFakeSource();
    const outputGain = createFakeGain();
    const voiceGain = createFakeGain();
    const audioContext = createFakeAudioContext([source], [outputGain, voiceGain]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'set', time: 12.5, value: 0.75 });

    expect(voiceGain.gain.value).toBe(0.75);
    expect(source.start).toHaveBeenCalledWith(12.5, 0, undefined);
  });

  it('ignores scheduled set messages with invalid gain', () => {
    const source = createFakeSource();
    const audioContext = createFakeAudioContext([source]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'set', time: 12.5, value: -1 });

    expect(source.start).not.toHaveBeenCalled();
  });

  it('ignores untimed set messages', () => {
    const source = createFakeSource();
    const audioContext = createFakeAudioContext([source]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'set', value: 0.75 });

    expect(source.start).not.toHaveBeenCalled();
  });

  it('schedules bang messages with time', () => {
    const source = createFakeSource();
    const audioContext = createFakeAudioContext([source]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'bang', time: 12.5 });

    expect(source.start).toHaveBeenCalledWith(12.5, 0, undefined);
  });

  it('schedules play messages with time, offset, duration, and gain', () => {
    const source = createFakeSource();
    const outputGain = createFakeGain();
    const voiceGain = createFakeGain();
    const audioContext = createFakeAudioContext([source], [outputGain, voiceGain]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'play', time: 12.5, offset: 0.25, duration: 1.5, gain: 0.5 });

    expect(voiceGain.gain.value).toBe(0.5);
    expect(source.start).toHaveBeenCalledWith(12.5, 0.25, 1.5);
  });

  it('maps noteOn note to playback rate and velocity to gain', () => {
    const source = createFakeSource();
    const outputGain = createFakeGain();
    const voiceGain = createFakeGain();
    const audioContext = createFakeAudioContext([source], [outputGain, voiceGain]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'noteOn', note: 72, velocity: 64, time: 12.5 });

    expect(source.playbackRate.value).toBe(2);
    expect(voiceGain.gain.value).toBeCloseTo(64 / 127);
    expect(source.start).toHaveBeenCalledWith(12.5, 0, undefined);
  });

  it('ignores noteOff in one-shot mode', () => {
    const first = createFakeSource();
    const second = createFakeSource();
    const audioContext = createFakeAudioContext([first, second]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'noteOn', note: 60, velocity: 127 });
    node.send('message', { type: 'noteOn', note: 62, velocity: 127 });

    expect(first.stop).not.toHaveBeenCalled();

    node.send('message', { type: 'noteOff', note: 60 });

    expect(first.stop).not.toHaveBeenCalled();
    expect(second.stop).not.toHaveBeenCalled();
  });

  it('stops active note voices on noteOff in held mode', () => {
    const first = createFakeSource();
    const second = createFakeSource();
    const audioContext = createFakeAudioContext([first, second]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'setNoteOffMode', value: 'held' });
    node.send('message', { type: 'noteOn', note: 60, velocity: 127 });
    node.send('message', { type: 'noteOn', note: 62, velocity: 127 });

    expect(first.stop).not.toHaveBeenCalled();

    node.send('message', { type: 'noteOff', note: 60 });

    expect(first.stop).toHaveBeenCalledOnce();
    expect(second.stop).not.toHaveBeenCalled();
  });

  it('treats noteOn velocity 0 as noteOff in held mode', () => {
    const source = createFakeSource();
    const audioContext = createFakeAudioContext([source]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'setNoteOffMode', value: 'held' });
    node.send('message', { type: 'noteOn', note: 60, velocity: 127 });
    node.send('message', { type: 'noteOn', note: 60, velocity: 0 });

    expect(source.stop).toHaveBeenCalledOnce();
  });

  it('updates playback parameters on active note voices', () => {
    const source = createFakeSource();
    const audioContext = createFakeAudioContext([source]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'noteOn', note: 60, velocity: 127 });
    node.send('message', { type: 'setPlaybackRate', value: 1.5 });
    node.send('message', { type: 'setDetune', value: 1200 });

    expect(source.playbackRate.value).toBe(1.5);
    expect(source.detune.value).toBe(1200);
  });

  it('preserves note pitch multiplier when updating playback rate', () => {
    const source = createFakeSource();
    const audioContext = createFakeAudioContext([source]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'setPlaybackRate', value: 1.5 });
    node.send('message', { type: 'noteOn', note: 72, velocity: 127 });

    expect(source.playbackRate.value).toBe(3);

    node.send('message', { type: 'setPlaybackRate', value: 2 });

    expect(source.playbackRate.value).toBe(4);
  });

  it('keeps future noteOff voices tracked until they end', () => {
    const source = createFakeSource();
    const audioContext = createFakeAudioContext([source]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'setNoteOffMode', value: 'held' });
    node.send('message', { type: 'noteOn', note: 60, velocity: 127, time: 12.5 });
    node.send('message', { type: 'noteOff', note: 60, time: 13 });
    node.send('message', { type: 'setPlaybackRate', value: 1.5 });

    expect(source.stop).toHaveBeenCalledWith(13);
    expect(source.playbackRate.value).toBe(1.5);

    source.onended?.();
    node.send('message', { type: 'setPlaybackRate', value: 2 });

    expect(source.playbackRate.value).toBe(1.5);
  });

  it('schedules loop messages with time, offset, and duration', () => {
    const source = createFakeSource();
    const audioContext = createFakeAudioContext([source]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', {
      type: 'loop',
      start: 0.1,
      end: 0.9,
      time: 12.5,
      offset: 0.25,
      duration: 1.5
    });

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

  it('updates playback parameters on pending scheduled plays', () => {
    const source = createFakeSource();
    const audioContext = createFakeAudioContext([source]);
    const node = new SamplerNode('sampler-1', audioContext);

    node.audioBuffer = { duration: 4 } as AudioBuffer;
    node.send('message', { type: 'bang', time: 12.5 });
    node.send('message', { type: 'setPlaybackRate', value: 1.5 });
    node.send('message', { type: 'setDetune', value: 1200 });

    expect(source.playbackRate.value).toBe(1.5);
    expect(source.detune.value).toBe(1200);
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
