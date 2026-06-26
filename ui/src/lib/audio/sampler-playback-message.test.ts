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
});
