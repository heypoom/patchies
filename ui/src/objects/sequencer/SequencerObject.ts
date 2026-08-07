import { AudioService } from '$lib/audio/v2/AudioService';
import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectOutlet } from '$lib/objects/v2/object-metadata';
import {
  createSequencerPayload,
  sequencerOutputCarriesTiming,
  transportTimeToAudioContextTime,
  type MultiOutputMode,
  type SequencerOutputMode,
  type SingleOutputMode
} from './sequencer-output';
import { SequencerScheduler, type SequencerConfig } from './sequencer-scheduler';
import { Transport } from '$lib/transport';

import { SEQUENCER_INLETS, SEQUENCER_OUTLETS } from './sequencer-metadata';
import {
  getSequencerData,
  reduceSequencerMessage,
  type ResolvedSequencerData,
  type SequencerData
} from './sequencer-state';

export type { SequencerData } from './sequencer-state';

type SequencerSchedulerHandle = Pick<
  SequencerScheduler,
  'start' | 'setup' | 'clearMarkers' | 'dispose'
>;

export type SequencerSchedulerFactory = (
  nodeId: string,
  getConfig: () => SequencerConfig,
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
  static inlets = SEQUENCER_INLETS;
  static outlets = SEQUENCER_OUTLETS;

  private scheduler: SequencerSchedulerHandle | null = null;
  private schedulerConfig: SequencerConfig | null = null;

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

  destroy(): void {
    this.scheduler?.dispose();
    this.scheduler = null;
  }

  onMessage(message: unknown): void {
    const data = this.getData();
    const transition = reduceSequencerMessage(data, message);
    if (!transition) return;

    if (transition.fireStep !== undefined) {
      const time = data.audioRate ? AudioService.getInstance().getAudioContext().currentTime : 0;

      this.fireAtStep(transition.fireStep, time);
    }

    this.setData(transition.updates);
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

  private setData(updates: Partial<SequencerData>): void {
    this.context.setData(updates, { notifyUI: true });
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

  private getStepColors(step: number): string[] {
    const data = this.getData();
    if (!data.showInTimeline || data.muted) return [];

    return data.tracks
      .filter((track) => (track.stepOn[step] ?? false) && (track.stepValues[step] ?? 1) > 0)
      .map((track) => track.color);
  }

  private getSchedulerConfig(): SequencerConfig {
    const data = this.getData();

    return {
      clockMode: data.clockMode,
      audioRate: data.audioRate && sequencerOutputCarriesTiming(data.outletMode, data.outputMode),
      steps: data.steps,
      swing: data.swing
    };
  }

  private getData(): ResolvedSequencerData {
    return getSequencerData(this.context.getData<SequencerData>());
  }
}

function schedulerConfigsEqual(left: SequencerConfig, right: SequencerConfig): boolean {
  return (
    left.clockMode === right.clockMode &&
    left.audioRate === right.audioRate &&
    left.steps === right.steps &&
    left.swing === right.swing
  );
}

function assertSingleOutputMode(mode: SequencerOutputMode): SingleOutputMode {
  if (mode === 'index' || mode === 'midi') return mode;
  throw new Error(`Invalid sequencer output mode "${mode}" for single outlet mode`);
}

function assertMultiOutputMode(mode: SequencerOutputMode): MultiOutputMode {
  if (mode === 'bang' || mode === 'value') return mode;
  throw new Error(`Invalid sequencer output mode "${mode}" for multi outlet mode`);
}
