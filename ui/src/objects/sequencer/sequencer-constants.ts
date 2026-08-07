export const SEQUENCER_STEP_COUNTS = [4, 8, 12, 16, 24, 32] as const;
export const DEFAULT_SEQUENCER_STEP_COUNT = 16;

export type SequencerStepCount = (typeof SEQUENCER_STEP_COUNTS)[number];

export function isSequencerStepCount(value: unknown): value is SequencerStepCount {
  return SEQUENCER_STEP_COUNTS.includes(value as SequencerStepCount);
}
