import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPadBangVelocity, PadsAudioNode } from './PadsAudioNode';

function createFakeSource() {
  return {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null
  };
}

function createFakeGain() {
  return {
    gain: {
      value: 1,
      setTargetAtTime: vi.fn()
    },
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
    createBufferSource: () => sources[sourceIndex++] ?? createFakeSource()
  } as unknown as AudioContext;
}

describe('PadsAudioNode', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules MIDI noteOn playback at the message audio time', () => {
    const source = createFakeSource();
    const outputGain = createFakeGain();
    const voiceGain = createFakeGain();
    const audioContext = createFakeAudioContext([source], [outputGain, voiceGain]);
    const node = new PadsAudioNode('pads-1', audioContext);

    node.setBuffer(0, {} as AudioBuffer);
    node.send('message', { type: 'noteOn', note: 36, velocity: 100, time: 12.5 });

    expect(voiceGain.gain.value).toBeCloseTo(100 / 127);
    expect(source.start).toHaveBeenCalledWith(12.5);
  });

  it('schedules gated MIDI noteOff release at the message audio time', () => {
    const source = createFakeSource();
    const outputGain = createFakeGain();
    const voiceGain = createFakeGain();
    const audioContext = createFakeAudioContext([source], [outputGain, voiceGain]);
    const node = new PadsAudioNode('pads-1', audioContext);

    node.noteOffMode = 'stop';
    node.setBuffer(0, {} as AudioBuffer);
    node.send('message', { type: 'noteOn', note: 36, velocity: 100, time: 12.5 });
    node.send('message', { type: 'noteOff', note: 36, time: 13 });

    expect(voiceGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 13, 0.01);
    expect(source.stop).toHaveBeenCalledWith(13.05);
  });

  it('schedules single-index sequencer bang messages by pad index', () => {
    const source = createFakeSource();
    const outputGain = createFakeGain();
    const voiceGain = createFakeGain();
    const audioContext = createFakeAudioContext([source], [outputGain, voiceGain]);
    const node = new PadsAudioNode('pads-1', audioContext);

    node.setBuffer(2, {} as AudioBuffer);
    node.send('message', { type: 'bang', index: 2, value: 0.75, time: 12.5 });

    expect(source.start).toHaveBeenCalledWith(12.5);
  });

  it('delays visual triggers until scheduled playback time', () => {
    vi.useFakeTimers();

    const source = createFakeSource();
    const audioContext = createFakeAudioContext([source]);
    const node = new PadsAudioNode('pads-1', audioContext);
    const onTrigger = vi.fn();

    node.onTrigger = onTrigger;
    node.setBuffer(0, {} as AudioBuffer);
    node.send('message', { type: 'noteOn', note: 36, velocity: 100, time: 0.25 });

    expect(onTrigger).not.toHaveBeenCalled();

    vi.advanceTimersByTime(249);
    expect(onTrigger).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onTrigger).toHaveBeenCalledWith(0, 100);
  });
});

describe('getPadBangVelocity', () => {
  it('maps sequencer bang values to pad velocity', () => {
    expect(getPadBangVelocity(0)).toBe(0);
    expect(getPadBangVelocity(0.75)).toBe(95.25);
    expect(getPadBangVelocity(1)).toBe(127);
  });

  it('ignores invalid sequencer bang values', () => {
    expect(getPadBangVelocity(-1)).toBeUndefined();
    expect(getPadBangVelocity(Number.NaN)).toBeUndefined();
    expect(getPadBangVelocity('0.75')).toBeUndefined();
  });
});
