export type SamplerPlaybackTrigger = {
  type: 'bang' | 'play';
  time?: unknown;
  offset?: unknown;
  duration?: unknown;
  gain?: unknown;
};

type SamplerPlaybackState = {
  hasRecording: boolean;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
};

type SamplerLoopPlaybackMessage = {
  type: 'loop';
  start: number;
  end: number;
  time?: unknown;
  offset?: unknown;
  duration?: unknown;
  gain?: unknown;
};

export function createSamplerPlaybackMessage(
  trigger: SamplerPlaybackTrigger,
  { hasRecording, loopEnabled, loopStart, loopEnd }: SamplerPlaybackState
): SamplerPlaybackTrigger | SamplerLoopPlaybackMessage | null {
  if (!hasRecording) return null;

  if (loopEnabled && loopEnd > loopStart) {
    const loopMessage: SamplerLoopPlaybackMessage = {
      type: 'loop',
      start: loopStart,
      end: loopEnd
    };

    if ('time' in trigger) loopMessage.time = trigger.time;
    if ('offset' in trigger) loopMessage.offset = trigger.offset;
    if ('duration' in trigger) loopMessage.duration = trigger.duration;
    if ('gain' in trigger) loopMessage.gain = trigger.gain;

    return loopMessage;
  }

  return trigger;
}
