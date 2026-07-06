import { describe, expect, it } from 'vitest';

import {
  advanceSamplerPlaybackProgress,
  addSamplerPlaybackProgressVoice,
  removeSamplerPlaybackProgressVoice,
  type SamplerPlaybackProgressVoice
} from './sampler-playback-progress';

describe('sampler playback progress tracking', () => {
  const sourceA = {} as AudioBufferSourceNode;
  const sourceB = {} as AudioBufferSourceNode;

  function addVoice(
    voices: Map<AudioBufferSourceNode, SamplerPlaybackProgressVoice>,
    source: AudioBufferSourceNode,
    offset: number,
    playbackRate: number
  ) {
    return addSamplerPlaybackProgressVoice(voices, {
      event: { source, time: 0, offset, playbackRate },
      loopStart: 0,
      loopEnd: 1,
      recordingDuration: 1
    });
  }

  it('does not auto-stop all playback when one overlapping voice reaches its end', () => {
    let voices = new Map<AudioBufferSourceNode, SamplerPlaybackProgressVoice>();
    voices = addVoice(voices, sourceA, 0.95, 1);
    voices = addVoice(voices, sourceB, 0, 0.5);

    const result = advanceSamplerPlaybackProgress(voices, {
      loopEnabled: false,
      loopStart: 0,
      stepSeconds: 0.1
    });

    expect(result.shouldStopPlayback).toBe(false);
    expect(result.voices.size).toBe(2);
  });

  it('auto-stops once the final active voice reaches its end', () => {
    let voices = new Map<AudioBufferSourceNode, SamplerPlaybackProgressVoice>();
    voices = addVoice(voices, sourceA, 0.95, 1);
    voices = addVoice(voices, sourceB, 0, 0.5);

    voices = removeSamplerPlaybackProgressVoice(voices, sourceB);
    const result = advanceSamplerPlaybackProgress(voices, {
      loopEnabled: false,
      loopStart: 0,
      stepSeconds: 0.1
    });

    expect(result.shouldStopPlayback).toBe(true);
  });

  it('wraps an active voice to loop start when looping past its end', () => {
    let voices = new Map<AudioBufferSourceNode, SamplerPlaybackProgressVoice>();
    voices = addVoice(voices, sourceA, 0.95, 1);

    const result = advanceSamplerPlaybackProgress(voices, {
      loopEnabled: true,
      loopStart: 0.25,
      stepSeconds: 0.1
    });

    expect(result.shouldStopPlayback).toBe(false);
    expect(result.voices.size).toBe(1);
    expect(result.voices.get(sourceA)?.progress).toBe(0.25);
  });

  it('treats event duration as relative to the playback offset', () => {
    let voices = new Map<AudioBufferSourceNode, SamplerPlaybackProgressVoice>();
    voices = addSamplerPlaybackProgressVoice(voices, {
      event: { source: sourceA, time: 0, offset: 0.8, duration: 0.5, playbackRate: 1 },
      loopStart: 0,
      loopEnd: 2,
      recordingDuration: 2
    });

    const result = advanceSamplerPlaybackProgress(voices, {
      loopEnabled: false,
      loopStart: 0,
      stepSeconds: 0.1
    });

    expect(result.shouldStopPlayback).toBe(false);
  });
});
