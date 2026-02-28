export type TimeMode = 'relative' | 'absolute';
export type CurveType = 'linear' | 'exponential' | 'targetAtTime' | 'valueCurve';

export interface TriggerPhaseConfig {
  time: number;

  curve?: CurveType;
  timeConstant?: number; // For targetAtTime curve
  values?: number[] | Float32Array; // For valueCurve
}

/** A phase config or a number shorthand (seconds with linear curve). */
export type PhaseInput = number | TriggerPhaseConfig;

export type TriggerValues = {
  start?: number; // defaults to 0
  peak: number;
  sustain: number;
};

type WithTime = {
  time?: number;
  timeMode?: TimeMode;
};

export interface SetMessage extends WithTime {
  type: 'set';
  value: number;
}

export interface TriggerMessage extends WithTime {
  type: 'trigger';

  attack: PhaseInput;
  decay: PhaseInput;

  values: TriggerValues;
}

export interface ReleaseMessage extends WithTime {
  type: 'release';

  release: PhaseInput;
  endValue: number;
}

export type ScheduledMessage = SetMessage | TriggerMessage | ReleaseMessage;

/** Normalize a number shorthand to a full TriggerPhaseConfig. */
export const normalizePhaseConfig = (input: PhaseInput): TriggerPhaseConfig =>
  typeof input === 'number' ? { time: input } : input;

export const isScheduledMessage = (value: unknown): value is ScheduledMessage =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  (['set', 'trigger', 'release'] as const).includes(
    (value as { type: 'set' | 'trigger' | 'release' }).type
  );
