import { match } from 'ts-pattern';

import { DEFAULT_TRACKS, type TrackData } from '$lib/nodes/sequencer-constants';

import { DEFAULT_SEQUENCER_STEP_COUNT, isSequencerStepCount } from './sequencer-constants';
import { sequencerMessages } from './sequencer-metadata';
import type {
  MultiOutputMode,
  OutletMode,
  SequencerOutputMode,
  SingleOutputMode
} from './sequencer-output';

export type SequencerData = {
  steps?: number;
  tracks?: TrackData[];
  swing?: number;
  outletMode?: OutletMode;
  outputMode?: SequencerOutputMode;
  audioRate?: boolean;
  clockMode?: 'auto' | 'manual';
  showVelocity?: boolean;
  showInTimeline?: boolean;
  resizable?: boolean;
  muted?: boolean;
  manualStep?: number;
  currentStep?: number;
};

export type ResolvedSequencerData = Required<SequencerData>;

export type SequencerTransition = {
  updates: Partial<SequencerData>;
  fireStep?: number;
};

export function getSequencerData(data: SequencerData): ResolvedSequencerData {
  const outletMode = data.outletMode === 'single' ? 'single' : 'multi';

  return {
    steps: isSequencerStepCount(data.steps) ? data.steps : DEFAULT_SEQUENCER_STEP_COUNT,
    tracks: Array.isArray(data.tracks) ? data.tracks : DEFAULT_TRACKS,
    swing: typeof data.swing === 'number' ? data.swing : 0,
    outletMode,
    outputMode: normalizeOutputMode(outletMode, data.outputMode),
    audioRate: data.audioRate === true,
    clockMode: data.clockMode === 'manual' ? 'manual' : 'auto',
    showVelocity: data.showVelocity === true,
    showInTimeline: data.showInTimeline !== false,
    resizable: data.resizable === true,
    muted: data.muted === true,
    manualStep: typeof data.manualStep === 'number' ? Math.floor(data.manualStep) : 0,
    currentStep: typeof data.currentStep === 'number' ? Math.floor(data.currentStep) : -1
  };
}

export const sequencerMessageReducer = (
  data: ResolvedSequencerData,
  message: unknown,
  random: () => number = Math.random
): SequencerTransition | null =>
  match(message)
    .with(sequencerMessages.bang, () => advanceManualStep(data))
    .with(sequencerMessages.reset, () => resetManualStep(data))
    .with(sequencerMessages.goto, ({ step }) => goToManualStep(data, step))
    .with(sequencerMessages.setStep, ({ track, step, on }) => setStep(data, track, step, on))
    .with(sequencerMessages.setVelocityAll, ({ track, values }) =>
      setTrackVelocities(data, track, values)
    )
    .with(sequencerMessages.setVelocityOne, ({ track, step, value }) =>
      setStepVelocity(data, track, step, value)
    )
    .with(sequencerMessages.setPattern, ({ track, pattern }) =>
      setTrackPattern(data, track, pattern)
    )
    .with(sequencerMessages.clearTrack, ({ track }) => fillTrack(data, track, false))
    .with(sequencerMessages.clearAll, () => fillAll(data, false))
    .with(sequencerMessages.fillTrack, ({ track }) => fillTrack(data, track, true))
    .with(sequencerMessages.fillAll, () => fillAll(data, true))
    .with(sequencerMessages.randomAll, () => randomizeAll(data, random))
    .with(sequencerMessages.rotate, ({ track, amount }) => rotateTrack(data, track, amount))
    .with(sequencerMessages.setSwing, ({ value }) => transition({ swing: clamp(value, 0, 100) }))
    .with(sequencerMessages.setOutputMode, ({ value }) => setOutputMode(value))
    .with(sequencerMessages.setAudioRate, ({ value }) => transition({ audioRate: value }))
    .with(sequencerMessages.setClockMode, ({ value }) => transition({ clockMode: value }))
    .with(sequencerMessages.setStepCount, ({ value }) => setStepCount(data, value))
    .with(sequencerMessages.setOutletMode, ({ value }) => setOutletMode(value))
    .with(sequencerMessages.mute, () => transition({ muted: true }))
    .with(sequencerMessages.unmute, () => transition({ muted: false }))
    .otherwise(() => null);

function advanceManualStep(data: ResolvedSequencerData): SequencerTransition | null {
  if (data.clockMode !== 'manual') return null;

  const step = clamp(data.manualStep, 0, Math.max(0, data.steps - 1));

  return {
    fireStep: step,
    updates: {
      currentStep: step,
      manualStep: (step + 1) % data.steps
    }
  };
}

const resetManualStep = (data: ResolvedSequencerData): SequencerTransition | null =>
  data.clockMode === 'manual' ? transition({ manualStep: 0, currentStep: 0 }) : null;

function goToManualStep(data: ResolvedSequencerData, step: number): SequencerTransition | null {
  if (data.clockMode !== 'manual') return null;

  const nextStep = clamp(Math.floor(step), 0, data.steps - 1);

  return transition({
    manualStep: nextStep,
    currentStep: nextStep
  });
}

function setStep(
  data: ResolvedSequencerData,
  trackIndex: number,
  stepIndex: number,
  on: boolean
): SequencerTransition | null {
  if (!isValidTrackStep(data, trackIndex, stepIndex)) return null;

  return withTracks(
    data.tracks.map((track, index) => {
      if (index !== trackIndex) return track;

      const stepOn = [...track.stepOn];
      stepOn[stepIndex] = on;

      return { ...track, stepOn };
    })
  );
}

function setTrackVelocities(
  data: ResolvedSequencerData,
  trackIndex: number,
  values: number[]
): SequencerTransition | null {
  if (!isValidTrack(data, trackIndex)) return null;

  return withTracks(
    data.tracks.map((track, index) =>
      index === trackIndex
        ? {
            ...track,
            stepValues: Array.from({ length: data.steps }, (_, step) =>
              clamp(values[step] ?? track.stepValues[step] ?? 1, 0, 1)
            )
          }
        : track
    )
  );
}

function setStepVelocity(
  data: ResolvedSequencerData,
  trackIndex: number,
  stepIndex: number,
  value: number
): SequencerTransition | null {
  if (!isValidTrackStep(data, trackIndex, stepIndex)) return null;

  return withTracks(
    data.tracks.map((track, index) => {
      if (index !== trackIndex) return track;

      const stepValues = [...track.stepValues];
      stepValues[stepIndex] = clamp(value, 0, 1);

      return { ...track, stepValues };
    })
  );
}

function setTrackPattern(
  data: ResolvedSequencerData,
  trackIndex: number,
  pattern: boolean[]
): SequencerTransition | null {
  if (!isValidTrack(data, trackIndex)) return null;

  return withTracks(
    data.tracks.map((track, index) =>
      index === trackIndex
        ? {
            ...track,
            stepOn: Array.from({ length: data.steps }, (_, step) => pattern[step] ?? false)
          }
        : track
    )
  );
}

function fillTrack(
  data: ResolvedSequencerData,
  trackIndex: number,
  on: boolean
): SequencerTransition | null {
  if (!isValidTrack(data, trackIndex)) return null;

  return withTracks(
    data.tracks.map((track, index) =>
      index === trackIndex ? { ...track, stepOn: Array(data.steps).fill(on) } : track
    )
  );
}

const fillAll = (data: ResolvedSequencerData, on: boolean): SequencerTransition =>
  withTracks(data.tracks.map((track) => ({ ...track, stepOn: Array(data.steps).fill(on) })));

const randomizeAll = (data: ResolvedSequencerData, random: () => number): SequencerTransition =>
  withTracks(
    data.tracks.map((track) => ({
      ...track,
      stepOn: Array.from({ length: data.steps }, () => random() < 0.5),
      stepValues: Array.from({ length: data.steps }, () => random())
    }))
  );

function rotateTrack(
  data: ResolvedSequencerData,
  trackIndex: number,
  amount: number
): SequencerTransition | null {
  if (!isValidTrack(data, trackIndex)) return null;

  const shift = ((amount % data.steps) + data.steps) % data.steps;

  const tracks = data.tracks.map((track, index) =>
    index === trackIndex
      ? {
          ...track,
          stepOn: [
            ...track.stepOn.slice(data.steps - shift),
            ...track.stepOn.slice(0, data.steps - shift)
          ],
          stepValues: [
            ...track.stepValues.slice(data.steps - shift),
            ...track.stepValues.slice(0, data.steps - shift)
          ]
        }
      : track
  );

  return withTracks(tracks);
}

function setOutputMode(outputMode: SequencerOutputMode): SequencerTransition {
  const outletMode = outputMode === 'index' || outputMode === 'midi' ? 'single' : 'multi';

  return transition({ outputMode, outletMode });
}

const setOutletMode = (outletMode: OutletMode): SequencerTransition =>
  transition({
    outletMode,
    outputMode: outletMode === 'single' ? 'index' : 'bang'
  });

function setStepCount(data: ResolvedSequencerData, steps: number): SequencerTransition | null {
  if (!isSequencerStepCount(steps)) return null;

  const tracks = data.tracks.map((track) => ({
    ...track,
    stepOn: Array.from({ length: steps }, (_, index) => track.stepOn[index] ?? false),
    stepValues: Array.from({ length: steps }, (_, index) => track.stepValues[index] ?? 1)
  }));

  return transition({
    steps,
    tracks,
    manualStep: clamp(data.manualStep, 0, steps - 1),
    currentStep: clamp(data.currentStep, 0, steps - 1)
  });
}

function normalizeOutputMode(
  outletMode: OutletMode,
  outputMode: SequencerOutputMode | undefined
): SequencerOutputMode {
  if (outletMode === 'single') {
    return isSingleOutputMode(outputMode) ? outputMode : 'index';
  }

  return isMultiOutputMode(outputMode) ? outputMode : 'bang';
}

const isSingleOutputMode = (
  outputMode: SequencerOutputMode | undefined
): outputMode is SingleOutputMode => outputMode === 'index' || outputMode === 'midi';

const isMultiOutputMode = (
  outputMode: SequencerOutputMode | undefined
): outputMode is MultiOutputMode => outputMode === 'bang' || outputMode === 'value';

const withTracks = (tracks: TrackData[]): SequencerTransition => transition({ tracks });
const transition = (updates: Partial<SequencerData>): SequencerTransition => ({ updates });

const isValidTrack = (data: ResolvedSequencerData, track: number): boolean =>
  Number.isInteger(track) && track >= 0 && track < data.tracks.length;

const isValidTrackStep = (data: ResolvedSequencerData, track: number, step: number): boolean =>
  isValidTrack(data, track) && Number.isInteger(step) && step >= 0 && step < data.steps;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
