import { describe, expect, it } from 'vitest';

import { createSamplerPlaybackMessage } from './sampler-playback-message';

describe('createSamplerPlaybackMessage', () => {
  it('preserves plain bang when playing a sampler one-shot', () => {
    expect(
      createSamplerPlaybackMessage(
        { type: 'bang' },
        { hasRecording: true, loopEnabled: false, loopStart: 0, loopEnd: 0.5 }
      )
    ).toEqual({ type: 'bang' });
  });

  it('preserves scheduled bang time when playing a sampler one-shot', () => {
    expect(
      createSamplerPlaybackMessage(
        { type: 'bang', time: 12.5 },
        { hasRecording: true, loopEnabled: false, loopStart: 0, loopEnd: 0.5 }
      )
    ).toEqual({ type: 'bang', time: 12.5 });
  });

  it('preserves scheduled trigger fields when loop playback is enabled', () => {
    expect(
      createSamplerPlaybackMessage(
        { type: 'bang', time: 12.5, offset: 0.25, duration: 1.5, value: 0.75 },
        { hasRecording: true, loopEnabled: true, loopStart: 0.1, loopEnd: 0.9 }
      )
    ).toEqual({
      type: 'loop',
      start: 0.1,
      end: 0.9,
      time: 12.5,
      offset: 0.25,
      duration: 1.5,
      value: 0.75
    });
  });

  it('drops invalid trigger values when loop playback is enabled', () => {
    const state = { hasRecording: true, loopEnabled: true, loopStart: 0.1, loopEnd: 0.9 };

    expect(createSamplerPlaybackMessage({ type: 'bang', value: -1 }, state)).toEqual({
      type: 'loop',
      start: 0.1,
      end: 0.9
    });

    expect(createSamplerPlaybackMessage({ type: 'bang', value: Number.NaN }, state)).toEqual({
      type: 'loop',
      start: 0.1,
      end: 0.9
    });
  });
});
