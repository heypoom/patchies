import { BASE_NOTE } from '$objects/pads/constants';

export type OutletMode = 'multi' | 'single';
export type MultiOutputMode = 'bang' | 'value';
export type SingleOutputMode = 'index' | 'midi';
export type SequencerOutputMode = MultiOutputMode | SingleOutputMode;

type CreateSequencerPayloadOptions = {
  outletMode: OutletMode;
  outputMode: SequencerOutputMode;
  audioRate: boolean;
  trackIndex: number;
  velocity: number;
  time: number;
};

type TransportTimeToAudioContextTimeOptions = {
  scheduledTransportTime: number;
  currentTransportTime: number;
  audioContextTime: number;
};

export function transportTimeToAudioContextTime({
  scheduledTransportTime,
  currentTransportTime,
  audioContextTime
}: TransportTimeToAudioContextTimeOptions): number {
  return audioContextTime + Math.max(0, scheduledTransportTime - currentTransportTime);
}

export function createSequencerPayload({
  outletMode,
  outputMode,
  audioRate,
  trackIndex,
  velocity,
  time
}: CreateSequencerPayloadOptions): unknown {
  if (outletMode === 'single') {
    if (outputMode === 'midi') {
      return audioRate
        ? {
            type: 'noteOn',
            note: BASE_NOTE + trackIndex,
            index: trackIndex,
            velocity: Math.round(velocity * 127),
            time
          }
        : {
            type: 'noteOn',
            note: BASE_NOTE + trackIndex,
            index: trackIndex,
            velocity: Math.round(velocity * 127)
          };
    }

    return trackIndex;
  }

  if (outputMode === 'value') {
    return audioRate ? { type: 'set', time, value: velocity } : velocity;
  }

  return audioRate ? { type: 'bang', time } : { type: 'bang' };
}
