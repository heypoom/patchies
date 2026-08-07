import { match } from 'ts-pattern';

import { BASE_NOTE } from '$lib/midi/drums';

export type OutletMode = 'multi' | 'single';
export type MultiOutputMode = 'bang' | 'value';
export type SingleOutputMode = 'index' | 'midi';
export type SequencerOutputMode = MultiOutputMode | SingleOutputMode;

type SequencerOutletOutputModes =
  | { outletMode: 'multi'; outputMode: MultiOutputMode }
  | { outletMode: 'single'; outputMode: SingleOutputMode };

type CreateSequencerPayloadOptions = {
  audioRate: boolean;
  trackIndex: number;
  velocity: number;
  time: number;
} & SequencerOutletOutputModes;

interface TransportTimeToAudioContextTimeOptions {
  scheduledTransportTime: number;
  currentTransportTime: number;
  audioContextTime: number;
}

export const transportTimeToAudioContextTime = ({
  scheduledTransportTime,
  currentTransportTime,
  audioContextTime
}: TransportTimeToAudioContextTimeOptions): number =>
  audioContextTime + Math.max(0, scheduledTransportTime - currentTransportTime);

export const sequencerOutputCarriesTiming = (
  outletMode: OutletMode,
  outputMode: SequencerOutputMode
): boolean =>
  (outletMode === 'multi' && (outputMode === 'bang' || outputMode === 'value')) ||
  (outletMode === 'single' && (outputMode === 'index' || outputMode === 'midi'));

export const createSequencerPayload = ({
  outletMode,
  outputMode,
  audioRate,
  trackIndex,
  velocity,
  time
}: CreateSequencerPayloadOptions) =>
  match({ outletMode, outputMode })
    .with({ outletMode: 'single', outputMode: 'midi' }, () =>
      audioRate
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
          }
    )
    .with({ outletMode: 'single', outputMode: 'index' }, () =>
      audioRate ? { type: 'bang', index: trackIndex, value: velocity, time } : trackIndex
    )
    .with({ outletMode: 'multi', outputMode: 'value' }, () =>
      audioRate ? { type: 'bang', time, value: velocity } : velocity
    )
    .with({ outletMode: 'multi', outputMode: 'bang' }, () =>
      audioRate ? { type: 'bang', time } : { type: 'bang' }
    )
    .otherwise(() => invalidSequencerOutputMode(outletMode, outputMode));

function invalidSequencerOutputMode(outletMode: string, outputMode: string): never {
  if (outletMode === 'single' || outletMode === 'multi') {
    throw new Error(`Invalid sequencer output mode "${outputMode}" for ${outletMode} outlet mode`);
  }

  throw new Error(`Invalid sequencer outlet mode "${outletMode}"`);
}
