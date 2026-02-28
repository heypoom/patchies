import { match } from 'ts-pattern';
import type {
  ScheduledMessage,
  SetMessage,
  TriggerMessage,
  ReleaseMessage,
  TimeMode,
  TriggerPhaseConfig
} from './time-scheduling-types';
import { normalizePhaseConfig } from './time-scheduling-types';

export class TimeScheduler {
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  processMessage(param: AudioParam, message: ScheduledMessage) {
    match(message)
      .with({ type: 'set' }, (msg) => this.handleSetMessage(param, msg))
      .with({ type: 'trigger' }, (msg) => this.handleTriggerMessage(param, msg))
      .with({ type: 'release' }, (msg) => this.handleReleaseMessage(param, msg));
  }

  /** Resolve a time value based on timeMode (default: absolute), falling back to audioContext.currentTime. */
  private getTime(time?: number, timeMode?: TimeMode): number {
    return match(timeMode)
      .with('relative', () => this.audioContext.currentTime + (time ?? 0))
      .otherwise(() => time ?? this.audioContext.currentTime);
  }

  private handleSetMessage(param: AudioParam, message: SetMessage) {
    const time = this.getTime(message.time, message.timeMode);

    param.setValueAtTime(message.value, time);
  }

  private handleTriggerMessage(param: AudioParam, message: TriggerMessage) {
    const startTime = this.getTime(message.time, message.timeMode);
    const attack = normalizePhaseConfig(message.attack);
    const decay = normalizePhaseConfig(message.decay);

    param.cancelScheduledValues(startTime);
    param.setValueAtTime(message.values.start ?? 0, startTime);

    this.applyPhase(param, message.values.peak, startTime, attack);

    const decayStartTime = startTime + attack.time;
    this.applyPhase(param, message.values.sustain, decayStartTime, decay);
  }

  private handleReleaseMessage(param: AudioParam, message: ReleaseMessage) {
    const startTime = this.getTime(message.time, message.timeMode);
    const release = normalizePhaseConfig(message.release);

    // Capture the current value before canceling scheduled values.
    const currentValue = param.value;

    param.cancelScheduledValues(startTime);
    param.setValueAtTime(currentValue, startTime);

    this.applyPhase(param, message.endValue ?? 0, startTime, release);
  }

  private applyPhase(
    param: AudioParam,
    targetValue: number,
    startTime: number,
    config: TriggerPhaseConfig
  ) {
    const endTime = startTime + config.time;

    match(config.curve ?? 'linear')
      .with('linear', () => {
        param.linearRampToValueAtTime(targetValue, endTime);
      })
      .with('exponential', () => {
        // Ensure targetValue is not zero for exponential ramp
        const safeTargetValue = targetValue === 0 ? 0.0001 : targetValue;

        param.exponentialRampToValueAtTime(safeTargetValue, endTime);
      })
      .with('targetAtTime', () => {
        const timeConstant = config.timeConstant ?? config.time * 0.3;

        param.setTargetAtTime(targetValue, startTime, timeConstant);
      })
      .with('valueCurve', () => {
        if (config.values && config.values.length >= 2) {
          param.setValueCurveAtTime(config.values, startTime, config.time);
        }
      });
  }
}
