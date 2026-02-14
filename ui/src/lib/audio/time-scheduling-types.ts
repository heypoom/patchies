export type TimeMode = 'relative' | 'absolute';
export type CurveType = 'linear' | 'exponential' | 'targetAtTime' | 'valueCurve';

export interface TriggerPhaseConfig {
  time: number;
  curve?: CurveType;
  timeConstant?: number; // For targetAtTime curve
  values?: number[] | Float32Array; // For valueCurve
}

export interface SetMessage {
  type: 'set';
  value: number;
  time?: number;
  timeMode?: TimeMode;
}

export interface TriggerMessage {
  type: 'trigger';
  values: {
    start: number;
    peak: number;
    sustain: number;
  };
  attack: TriggerPhaseConfig;
  decay: TriggerPhaseConfig;
}

export interface ReleaseMessage {
  type: 'release';
  release: TriggerPhaseConfig;
  endValue: number;
}

export type ScheduledMessage = SetMessage | TriggerMessage | ReleaseMessage;

export function isScheduledMessage(value: unknown): value is ScheduledMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    (['set', 'trigger', 'release'] as const).includes(
      (value as { type: 'set' | 'trigger' | 'release' }).type
    )
  );
}
