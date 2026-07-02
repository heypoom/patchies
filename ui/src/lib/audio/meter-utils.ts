export { calculateRms } from './rms';

export interface MeterChannelState {
  level: number;
  peak: number;
  peakHoldTime: number;
}

export interface UpdateMeterChannelsOptions {
  previous: MeterChannelState[];
  levels: number[];
  smoothing: number;
  peakHold: boolean;
  now: number;
  peakHoldDuration?: number;
}

export const METER_MIN_DB = -60;
export const METER_MAX_DB = 0;
export const METER_PEAK_HOLD_DURATION = 1000;

export function sanitizeMeterLevel(level: number): number {
  if (!Number.isFinite(level) || level < 0.001) return 0;

  return Math.min(1, Math.max(0, level));
}

export function updateMeterChannels({
  previous,
  levels,
  smoothing,
  peakHold,
  now,
  peakHoldDuration = METER_PEAK_HOLD_DURATION
}: UpdateMeterChannelsOptions): MeterChannelState[] {
  const channelCount = Math.max(1, previous.length, levels.length);

  return Array.from({ length: channelCount }, (_, index) => {
    const instantLevel = sanitizeMeterLevel(levels[index] ?? 0);
    const previousChannel = previous[index] ?? { level: 0, peak: 0, peakHoldTime: 0 };

    const level =
      instantLevel > previousChannel.level
        ? instantLevel
        : previousChannel.level * smoothing + instantLevel * (1 - smoothing);

    if (instantLevel > previousChannel.peak) {
      return { level, peak: instantLevel, peakHoldTime: now };
    }

    if (peakHold && now - previousChannel.peakHoldTime <= peakHoldDuration) {
      return { level, peak: previousChannel.peak, peakHoldTime: previousChannel.peakHoldTime };
    }

    const decayedPeak = previousChannel.peak * 0.995;

    return {
      level,
      peak: decayedPeak < 0.001 ? 0 : decayedPeak,
      peakHoldTime: previousChannel.peakHoldTime
    };
  });
}

export function amplitudeToMeterPosition(amplitude: number): number {
  if (amplitude <= 0) return 0;

  const db = 20 * Math.log10(amplitude);
  const clamped = Math.max(METER_MIN_DB, Math.min(METER_MAX_DB, db));

  return (clamped - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB);
}
