import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import { AudioService } from '$lib/audio/v2/AudioService';
import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { Bang, Clear, Reset, messages } from '$lib/objects/schemas/common';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';
import {
  createSequencerPayload,
  sequencerOutputCarriesTiming,
  transportTimeToAudioContextTime,
  type MultiOutputMode,
  type OutletMode,
  type SequencerOutputMode,
  type SingleOutputMode
} from '$lib/sequencer/sequencer-output';
import { SequencerScheduler } from '$lib/sequencer/sequencer-scheduler';
import { Transport } from '$lib/transport';

import { DEFAULT_TRACKS, type TrackData } from '$lib/nodes/sequencer-constants';

const Goto = msg('goto', { step: Type.Number() });
const SetStep = msg('setStep', {
  track: Type.Number(),
  step: Type.Number(),
  on: Type.Boolean()
});
const SetVelocityAll = msg('setVelocity', {
  track: Type.Number(),
  values: Type.Array(Type.Number())
});
const SetVelocityOne = msg('setVelocity', {
  track: Type.Number(),
  step: Type.Number(),
  value: Type.Number()
});
const SetPattern = msg('setPattern', {
  track: Type.Number(),
  pattern: Type.Array(Type.Boolean())
});
const ClearTrack = msg('clear', { track: Type.Number() });
const FillAll = sym('fill');
const FillTrack = msg('fill', { track: Type.Number() });
const RandomAll = sym('random');
const Rotate = msg('rotate', { track: Type.Number(), amount: Type.Number() });
const Mute = sym('mute');
const Unmute = sym('unmute');
const SetSwing = msg('setSwing', { value: Type.Number() });
const SetOutputMode = msg('setOutputMode', {
  value: Type.Union([
    Type.Literal('bang'),
    Type.Literal('value'),
    Type.Literal('index'),
    Type.Literal('midi')
  ])
});
const SetAudioRate = msg('setAudioRate', { value: Type.Boolean() });
const SetOutletMode = msg('setOutletMode', {
  value: Type.Union([Type.Literal('multi'), Type.Literal('single')])
});
const SetClockMode = msg('setClockMode', {
  value: Type.Union([Type.Literal('auto'), Type.Literal('manual')])
});
const SetStepCount = msg('setStepCount', { value: Type.Number() });
const BangOutput = msg('bang', {
  time: Type.Optional(Type.Number()),
  value: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  index: Type.Optional(Type.Number({ minimum: 0 }))
});
const NoteOnOutput = msg('noteOn', {
  note: Type.Number(),
  index: Type.Number(),
  velocity: Type.Number({ minimum: 0, maximum: 127 }),
  time: Type.Optional(Type.Number())
});

const sequencerMessages = {
  bang: messages.bang,
  reset: messages.reset,
  goto: schema(Goto),
  mute: schema(Mute),
  unmute: schema(Unmute),
  setStep: schema(SetStep),
  setVelocityAll: schema(SetVelocityAll),
  setVelocityOne: schema(SetVelocityOne),
  setPattern: schema(SetPattern),
  clearTrack: schema(ClearTrack),
  clearAll: messages.clear,
  fillTrack: schema(FillTrack),
  fillAll: schema(FillAll),
  randomAll: schema(RandomAll),
  rotate: schema(Rotate),
  setSwing: schema(SetSwing),
  setOutputMode: schema(SetOutputMode),
  setAudioRate: schema(SetAudioRate),
  setOutletMode: schema(SetOutletMode),
  setClockMode: schema(SetClockMode),
  setStepCount: schema(SetStepCount)
};

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
  muted?: boolean;
  manualStep?: number;
  currentStep?: number;
};

type SchedulerConfig = {
  clockMode: 'auto' | 'manual';
  audioRate: boolean;
  steps: number;
  swing: number;
};

type SequencerSchedulerHandle = Pick<
  SequencerScheduler,
  'start' | 'setup' | 'clearMarkers' | 'dispose'
>;

export type SequencerSchedulerFactory = (
  nodeId: string,
  getConfig: () => SchedulerConfig,
  onFire: (step: number, time: number) => void,
  getStepColors: (step: number) => string[]
) => SequencerSchedulerHandle;

const defaultSchedulerFactory: SequencerSchedulerFactory = (...args) =>
  new SequencerScheduler(...args);

export class SequencerObject implements TextObjectV2 {
  static type = 'sequencer';
  static category = 'control';
  static description =
    'DAW-style step sequencer with up to 8 tracks. Runs synced to the transport or advances one step per bang.';
  static tags = ['sequencer', 'step', 'rhythm', 'transport', 'trigger', 'control', 'beat', 'drum'];
  static hasDynamicOutlets = true;
  static handlePatterns = {
    outlet: {
      template: 'out-{index}',
      description: 'Per-track outlet (out-0, out-1, ..., out-7). No type prefix.'
    }
  };

  static inlets: ObjectInlet[] = [
    {
      name: 'message',
      type: 'message',
      description: 'Control inlet',
      handle: { handleType: 'message' },
      messages: [
        { schema: Mute, description: 'Silence all output' },
        { schema: Unmute, description: 'Restore output after mute' },
        { schema: SetSwing, description: 'Set swing amount (0–100)' },
        {
          schema: SetOutputMode,
          description: 'Set output mode (multi: bang/value, single: index/midi)'
        },
        {
          schema: SetAudioRate,
          description: 'Enable or disable audio lookahead timestamps on output'
        },
        {
          schema: SetOutletMode,
          description: 'Set outlet mode (multi = one outlet per track, single = one merged outlet)'
        },
        { schema: SetClockMode, description: 'Set clock mode (auto / manual)' },
        { schema: SetStepCount, description: 'Set number of steps (4, 8, 12, 16, 24, or 32)' },
        { schema: Bang, description: 'Advance one step (manual)' },
        { schema: Reset, description: 'Set step to 0 (manual)' },
        { schema: Goto, description: 'Jump to a step (manual)' },
        { schema: SetStep, description: 'Set a specific step on or off' },
        { schema: SetVelocityOne, description: 'Set velocity for a single step (0–1)' },
        { schema: SetVelocityAll, description: 'Set velocity for every step of a track' },
        { schema: SetPattern, description: 'Replace the on/off pattern for a track' },
        { schema: Clear, description: 'Clear all steps' },
        { schema: FillAll, description: 'Turn on all steps' },
        { schema: RandomAll, description: 'Randomize on/off and velocity' },
        { schema: ClearTrack, description: 'Clear all steps for a track' },
        { schema: FillTrack, description: 'Turn on all steps for a track' },
        {
          schema: Rotate,
          description:
            "Rotate a track's pattern by N steps (positive = right/later, negative = left/earlier)"
        }
      ]
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'track',
      type: 'message',
      description:
        'Multi-outlet mode: per-track trigger outlet (one per track, numbered 0–7). Single-outlet mode: one merged outlet.',
      handle: { handleId: 0 },
      messages: [
        {
          schema: BangOutput,
          description:
            'Bang output. Audio lookahead adds time; value mode adds velocity; single/index mode also adds track index.'
        },
        {
          schema: Type.Number({ minimum: 0 }),
          description:
            'Number output: multi/value sends velocity 0–1; single/index sends track index.'
        },
        {
          schema: NoteOnOutput,
          description:
            'Single/midi output. Audio lookahead adds time; velocity is MIDI 0–127 and note follows the GM drum map.'
        }
      ]
    }
  ];

  private scheduler: SequencerSchedulerHandle | null = null;
  private schedulerConfig: SchedulerConfig | null = null;

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext,
    private readonly createScheduler: SequencerSchedulerFactory = defaultSchedulerFactory
  ) {}

  create(): void {
    this.schedulerConfig = this.getSchedulerConfig();
    this.scheduler = this.createScheduler(
      this.nodeId,
      () => this.getSchedulerConfig(),
      (step, time) => this.fireAtStep(step, time),
      (step) => this.getStepColors(step)
    );
    this.scheduler.start();
  }

  update(): void {
    this.syncSchedulerState();
  }

  private syncSchedulerState(): void {
    const nextConfig = this.getSchedulerConfig();

    if (!this.schedulerConfig || !schedulerConfigsEqual(this.schedulerConfig, nextConfig)) {
      this.schedulerConfig = nextConfig;
      this.scheduler?.setup();
    }

    const data = this.getData();

    if (data.muted || !data.showInTimeline) {
      this.scheduler?.clearMarkers();
    }
  }

  destroy(): void {
    this.scheduler?.dispose();
    this.scheduler = null;
  }

  onMessage(data: unknown): void {
    match(data)
      .with(sequencerMessages.bang, () => this.advanceManualStep())
      .with(sequencerMessages.reset, () => this.resetManualStep())
      .with(sequencerMessages.goto, ({ step }) => this.goToManualStep(step))
      .with(sequencerMessages.setStep, ({ track, step, on }) => this.setStep(track, step, on))
      .with(sequencerMessages.setVelocityAll, ({ track, values }) =>
        this.setTrackVelocities(track, values)
      )
      .with(sequencerMessages.setVelocityOne, ({ track, step, value }) =>
        this.setStepVelocity(track, step, value)
      )
      .with(sequencerMessages.setPattern, ({ track, pattern }) =>
        this.setTrackPattern(track, pattern)
      )
      .with(sequencerMessages.clearTrack, ({ track }) => this.fillTrack(track, false))
      .with(sequencerMessages.clearAll, () => this.fillAll(false))
      .with(sequencerMessages.fillTrack, ({ track }) => this.fillTrack(track, true))
      .with(sequencerMessages.fillAll, () => this.fillAll(true))
      .with(sequencerMessages.randomAll, () => this.randomizeAll())
      .with(sequencerMessages.rotate, ({ track, amount }) => this.rotateTrack(track, amount))
      .with(sequencerMessages.setSwing, ({ value }) =>
        this.setData({ swing: clamp(value, 0, 100) })
      )
      .with(sequencerMessages.setOutputMode, ({ value }) => this.setOutputMode(value))
      .with(sequencerMessages.setAudioRate, ({ value }) => this.setData({ audioRate: value }))
      .with(sequencerMessages.setClockMode, ({ value }) => this.setData({ clockMode: value }))
      .with(sequencerMessages.setStepCount, ({ value }) => this.setStepCount(value))
      .with(sequencerMessages.setOutletMode, ({ value }) => this.setOutletMode(value))
      .with(sequencerMessages.mute, () => this.setData({ muted: true }))
      .with(sequencerMessages.unmute, () => this.setData({ muted: false }))
      .otherwise(() => {});
  }

  getOutlets(): ObjectOutlet[] {
    const data = this.getData();
    const count = data.outletMode === 'single' ? 1 : data.tracks.length;

    return Array.from({ length: count }, (_, index) => ({
      ...SequencerObject.outlets[0],
      name: data.outletMode === 'single' ? 'out' : (data.tracks[index]?.name ?? String(index)),
      handle: { handleId: index }
    }));
  }

  private fireAtStep(stepIndex: number, time: number): void {
    const data = this.getData();
    if (data.muted) return;

    const sendsTimedOutput =
      data.audioRate && sequencerOutputCarriesTiming(data.outletMode, data.outputMode);

    const payloadTime = sendsTimedOutput
      ? transportTimeToAudioContextTime({
          scheduledTransportTime: time,
          currentTransportTime: Transport.seconds,
          audioContextTime: AudioService.getInstance().getAudioContext().currentTime
        })
      : time;

    for (let trackIndex = 0; trackIndex < data.tracks.length; trackIndex++) {
      const track = data.tracks[trackIndex];
      if (!(track?.stepOn[stepIndex] ?? false)) continue;

      const velocity = track.stepValues[stepIndex] ?? 1;

      const payload = createSequencerPayload(
        data.outletMode === 'single'
          ? {
              outletMode: 'single',
              outputMode: assertSingleOutputMode(data.outputMode),
              audioRate: sendsTimedOutput,
              trackIndex,
              velocity,
              time: payloadTime
            }
          : {
              outletMode: 'multi',
              outputMode: assertMultiOutputMode(data.outputMode),
              audioRate: sendsTimedOutput,
              trackIndex,
              velocity,
              time: payloadTime
            }
      );

      this.context.send(payload, { to: data.outletMode === 'single' ? 0 : trackIndex });
    }
  }

  private advanceManualStep(): void {
    const data = this.getData();
    if (data.clockMode !== 'manual') return;

    const step = clamp(Math.floor(data.manualStep), 0, Math.max(0, data.steps - 1));
    const audioTime = data.audioRate ? AudioService.getInstance().getAudioContext().currentTime : 0;

    this.fireAtStep(step, audioTime);

    this.setData({
      currentStep: step,
      manualStep: (step + 1) % data.steps
    });
  }

  private resetManualStep(): void {
    if (this.getData().clockMode !== 'manual') return;

    this.setData({
      manualStep: 0,
      currentStep: 0
    });
  }

  private goToManualStep(step: number): void {
    const data = this.getData();
    if (data.clockMode !== 'manual') return;

    const nextStep = clamp(Math.floor(step), 0, data.steps - 1);

    this.setData({
      manualStep: nextStep,
      currentStep: nextStep
    });
  }

  private setStep(trackIndex: number, stepIndex: number, on: boolean): void {
    const data = this.getData();
    if (!isValidTrackStep(data, trackIndex, stepIndex)) return;

    this.setTracks(
      data.tracks.map((track, index) => {
        if (index !== trackIndex) return track;

        const stepOn = [...track.stepOn];
        stepOn[stepIndex] = on;

        return { ...track, stepOn };
      })
    );
  }

  private setTrackVelocities(trackIndex: number, values: number[]): void {
    const data = this.getData();
    if (!isValidTrack(data, trackIndex)) return;

    this.setTracks(
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

  private setStepVelocity(trackIndex: number, stepIndex: number, value: number): void {
    const data = this.getData();
    if (!isValidTrackStep(data, trackIndex, stepIndex)) return;

    this.setTracks(
      data.tracks.map((track, index) => {
        if (index !== trackIndex) return track;
        const stepValues = [...track.stepValues];
        stepValues[stepIndex] = clamp(value, 0, 1);
        return { ...track, stepValues };
      })
    );
  }

  private setTrackPattern(trackIndex: number, pattern: boolean[]): void {
    const data = this.getData();
    if (!isValidTrack(data, trackIndex)) return;

    this.setTracks(
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

  private fillTrack(trackIndex: number, on: boolean): void {
    const data = this.getData();
    if (!isValidTrack(data, trackIndex)) return;

    this.setTracks(
      data.tracks.map((track, index) =>
        index === trackIndex ? { ...track, stepOn: Array(data.steps).fill(on) } : track
      )
    );
  }

  private fillAll(on: boolean): void {
    const data = this.getData();

    this.setTracks(data.tracks.map((track) => ({ ...track, stepOn: Array(data.steps).fill(on) })));
  }

  private randomizeAll(): void {
    const data = this.getData();

    this.setTracks(
      data.tracks.map((track) => ({
        ...track,
        stepOn: Array.from({ length: data.steps }, () => Math.random() < 0.5),
        stepValues: Array.from({ length: data.steps }, () => Math.random())
      }))
    );
  }

  private rotateTrack(trackIndex: number, amount: number): void {
    const data = this.getData();
    if (!isValidTrack(data, trackIndex)) return;

    const shift = ((amount % data.steps) + data.steps) % data.steps;

    this.setTracks(
      data.tracks.map((track, index) =>
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
      )
    );
  }

  private setOutputMode(outputMode: SequencerOutputMode): void {
    const outletMode =
      outputMode === 'index' || outputMode === 'midi'
        ? 'single'
        : outputMode === 'bang' || outputMode === 'value'
          ? 'multi'
          : this.getData().outletMode;

    this.setData({ outputMode, outletMode });
  }

  private setOutletMode(outletMode: OutletMode): void {
    this.setData({
      outletMode,
      outputMode: outletMode === 'single' ? 'index' : 'bang'
    });
  }

  private setStepCount(steps: number): void {
    const data = this.getData();
    const nextSteps = Math.max(1, Math.floor(steps));

    const tracks = data.tracks.map((track) => ({
      ...track,
      stepOn: Array.from({ length: nextSteps }, (_, index) => track.stepOn[index] ?? false),
      stepValues: Array.from({ length: nextSteps }, (_, index) => track.stepValues[index] ?? 1)
    }));

    this.setData({
      steps: nextSteps,
      tracks,
      manualStep: clamp(data.manualStep, 0, nextSteps - 1),
      currentStep: clamp(data.currentStep, 0, nextSteps - 1)
    });
  }

  private setTracks(tracks: TrackData[]): void {
    this.setData({ tracks });
  }

  private setData(updates: Partial<SequencerData>): void {
    this.context.setData(updates, { notifyUI: true });
    this.syncSchedulerState();
  }

  private getStepColors(step: number): string[] {
    const data = this.getData();

    if (!data.showInTimeline || data.muted) return [];

    return data.tracks
      .filter((track) => (track.stepOn[step] ?? false) && (track.stepValues[step] ?? 1) > 0)
      .map((track) => track.color);
  }

  private getSchedulerConfig(): SchedulerConfig {
    const data = this.getData();

    return {
      clockMode: data.clockMode,
      audioRate: data.audioRate && sequencerOutputCarriesTiming(data.outletMode, data.outputMode),
      steps: data.steps,
      swing: data.swing
    };
  }

  private getData(): Required<SequencerData> {
    const data = this.context.getData<SequencerData>();
    const outletMode = data.outletMode === 'single' ? 'single' : 'multi';

    return {
      steps: typeof data.steps === 'number' && data.steps > 0 ? Math.floor(data.steps) : 16,
      tracks: Array.isArray(data.tracks) ? data.tracks : DEFAULT_TRACKS,
      swing: typeof data.swing === 'number' ? data.swing : 0,
      outletMode,
      outputMode: data.outputMode ?? (outletMode === 'single' ? 'index' : 'bang'),
      audioRate: data.audioRate === true,
      clockMode: data.clockMode === 'manual' ? 'manual' : 'auto',
      showVelocity: data.showVelocity === true,
      showInTimeline: data.showInTimeline !== false,
      muted: data.muted === true,
      manualStep: typeof data.manualStep === 'number' ? Math.floor(data.manualStep) : 0,
      currentStep: typeof data.currentStep === 'number' ? Math.floor(data.currentStep) : -1
    };
  }
}

function schedulerConfigsEqual(left: SchedulerConfig, right: SchedulerConfig): boolean {
  return (
    left.clockMode === right.clockMode &&
    left.audioRate === right.audioRate &&
    left.steps === right.steps &&
    left.swing === right.swing
  );
}

function isValidTrack(data: Required<SequencerData>, track: number): boolean {
  return Number.isInteger(track) && track >= 0 && track < data.tracks.length;
}

function isValidTrackStep(data: Required<SequencerData>, track: number, step: number): boolean {
  return isValidTrack(data, track) && Number.isInteger(step) && step >= 0 && step < data.steps;
}

function assertSingleOutputMode(mode: SequencerOutputMode): SingleOutputMode {
  if (mode === 'index' || mode === 'midi') return mode;
  throw new Error(`Invalid sequencer output mode "${mode}" for single outlet mode`);
}

function assertMultiOutputMode(mode: SequencerOutputMode): MultiOutputMode {
  if (mode === 'bang' || mode === 'value') return mode;
  throw new Error(`Invalid sequencer output mode "${mode}" for multi outlet mode`);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
