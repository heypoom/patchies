import type { SamplerPlaybackStartEvent } from '$objects/sampler~/SamplerNode';

export type SamplerPlaybackProgressVoice = {
  source: AudioBufferSourceNode;
  progress: number;
  end: number;
  playbackRate: number;
};

export type SamplerPlaybackProgressOptions = {
  loopStart: number;
  loopEnd: number;
  recordingDuration: number;
};

export function addSamplerPlaybackProgressVoice(
  voices: Map<AudioBufferSourceNode, SamplerPlaybackProgressVoice>,
  {
    event,
    loopStart,
    loopEnd,
    recordingDuration
  }: { event: SamplerPlaybackStartEvent } & SamplerPlaybackProgressOptions
): Map<AudioBufferSourceNode, SamplerPlaybackProgressVoice> {
  const next = new Map(voices);
  const end =
    event.duration === undefined
      ? loopEnd > event.offset
        ? loopEnd
        : recordingDuration
      : event.offset + event.duration;

  next.set(event.source, {
    source: event.source,
    progress: event.offset ?? loopStart,
    end,
    playbackRate: event.playbackRate
  });

  return next;
}

export function removeSamplerPlaybackProgressVoice(
  voices: Map<AudioBufferSourceNode, SamplerPlaybackProgressVoice>,
  source: AudioBufferSourceNode
): Map<AudioBufferSourceNode, SamplerPlaybackProgressVoice> {
  const next = new Map(voices);
  next.delete(source);
  return next;
}

export function advanceSamplerPlaybackProgress(
  voices: Map<AudioBufferSourceNode, SamplerPlaybackProgressVoice>,
  {
    loopEnabled,
    loopStart,
    stepSeconds
  }: { loopEnabled: boolean; loopStart: number; stepSeconds: number }
): {
  voices: Map<AudioBufferSourceNode, SamplerPlaybackProgressVoice>;
  progress: number;
  shouldStopPlayback: boolean;
} {
  const activeVoiceCount = voices.size;
  const next = new Map<AudioBufferSourceNode, SamplerPlaybackProgressVoice>();
  let progress = 0;
  let shouldStopPlayback = false;

  for (const [source, voice] of voices) {
    let voiceProgress = voice.progress + stepSeconds * voice.playbackRate;

    if (loopEnabled && voiceProgress >= voice.end) {
      voiceProgress = loopStart;
    } else if (!loopEnabled && voiceProgress >= voice.end && activeVoiceCount === 1) {
      shouldStopPlayback = true;
    }

    const nextVoice = { ...voice, progress: voiceProgress };
    next.set(source, nextVoice);
    progress = Math.max(progress, voiceProgress);
  }

  return {
    voices: next,
    progress,
    shouldStopPlayback
  };
}
