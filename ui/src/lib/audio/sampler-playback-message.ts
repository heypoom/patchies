export type SamplerPlaybackTrigger = {
  [key: string]: unknown;
  type: 'bang' | 'play';
  time?: unknown;
  offset?: unknown;
  duration?: unknown;
};

type SamplerPlaybackState = {
  hasRecording: boolean;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
};

export function createSamplerPlaybackMessage(
  trigger: SamplerPlaybackTrigger,
  { hasRecording, loopEnabled, loopStart, loopEnd }: SamplerPlaybackState
): SamplerPlaybackTrigger | { type: 'loop'; start: number; end: number } | null {
  if (!hasRecording) return null;

  if (loopEnabled && loopEnd > loopStart) {
    return { type: 'loop', start: loopStart, end: loopEnd };
  }

  return trigger;
}
