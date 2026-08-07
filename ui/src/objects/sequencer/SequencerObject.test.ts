import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import { resolveMessageInlet } from '$lib/objects/v2/resolve-message-inlet';
import { schemaFromNode } from '$lib/objects/schemas/from-v2-node';

import {
  SequencerObject,
  type SequencerData,
  type SequencerSchedulerFactory
} from './SequencerObject';

const timing = vi.hoisted(() => ({
  audioContextTime: 0,
  transportTime: 0
}));

vi.mock('$lib/audio/v2/AudioService', () => ({
  AudioService: {
    getInstance: () => ({
      getAudioContext: () => ({ currentTime: timing.audioContextTime })
    })
  }
}));

vi.mock('$lib/transport', () => ({
  Transport: {
    get seconds() {
      return timing.transportTime;
    }
  }
}));

const TRACKS = [
  {
    name: 'KICK',
    color: '#f00',
    stepOn: [true, false, true, false],
    stepValues: [0.75, 1, 0.5, 1]
  },
  {
    name: 'SNARE',
    color: '#0af',
    stepOn: [false, true, false, true],
    stepValues: [1, 0.8, 1, 0.6]
  }
];

function createSequencer(initialData: SequencerData = {}) {
  const sent: Array<{ data: unknown; options: unknown }> = [];
  const values: Record<string, unknown> = {
    steps: 4,
    tracks: TRACKS,
    swing: 0,
    outletMode: 'multi',
    outputMode: 'bang',
    audioRate: false,
    clockMode: 'manual',
    showInTimeline: true,
    muted: false,
    ...initialData
  };
  const updates: Array<{ updates: Record<string, unknown>; options: unknown }> = [];
  const scheduler = {
    start: vi.fn(),
    setup: vi.fn(),
    clearMarkers: vi.fn(),
    dispose: vi.fn()
  };
  let fireStep: ((step: number, time: number) => void) | undefined;
  let getStepColors: ((step: number) => string[]) | undefined;

  const schedulerFactory: SequencerSchedulerFactory = vi.fn(
    (_nodeId, _getConfig, onFire, onGetStepColors) => {
      fireStep = onFire;
      getStepColors = onGetStepColors;
      return scheduler;
    }
  );

  const context = {
    send(data: unknown, options?: unknown) {
      sent.push({ data, options });
    },
    setData(nextValues: Record<string, unknown>, options?: unknown) {
      Object.assign(values, nextValues);
      updates.push({ updates: nextValues, options });
    },
    getData() {
      return values;
    }
  } as ObjectContext;

  const object = new SequencerObject('sequencer-1', context, schedulerFactory);

  return {
    object,
    scheduler,
    schedulerFactory,
    sent,
    updates,
    values,
    fireStep: (step: number, time = 0) => fireStep?.(step, time),
    getStepColors: (step: number) => getStepColors?.(step)
  };
}

describe('SequencerObject', () => {
  afterEach(() => {
    timing.audioContextTime = 0;
    timing.transportTime = 0;
  });

  it('owns the scheduler lifecycle without mounting a Svelte view', () => {
    const { object, scheduler, schedulerFactory } = createSequencer();

    object.create();

    expect(schedulerFactory).toHaveBeenCalledOnce();
    expect(scheduler.start).toHaveBeenCalledOnce();

    object.destroy();

    expect(scheduler.dispose).toHaveBeenCalledOnce();
  });

  it('emits active tracks from scheduler callbacks', () => {
    const { object, sent, fireStep } = createSequencer();
    object.create();

    fireStep(0);

    expect(sent).toEqual([{ data: { type: 'bang' }, options: { to: 0 } }]);
  });

  it('emits MIDI payloads from a single outlet', () => {
    const { object, sent, fireStep } = createSequencer({
      outletMode: 'single',
      outputMode: 'midi'
    });
    object.create();

    fireStep(0);

    expect(sent).toEqual([
      {
        data: { type: 'noteOn', note: 36, index: 0, velocity: 95 },
        options: { to: 0 }
      }
    ]);
  });

  it('converts scheduled transport time for audio-rate output', () => {
    timing.audioContextTime = 30;
    timing.transportTime = 12;

    const { object, sent, fireStep } = createSequencer({
      outletMode: 'single',
      outputMode: 'midi',
      audioRate: true
    });
    object.create();

    fireStep(0, 12.08);

    expect(sent).toEqual([
      {
        data: { type: 'noteOn', note: 36, index: 0, velocity: 95, time: 30.08 },
        options: { to: 0 }
      }
    ]);
  });

  it('advances and stores manual clock state on bang', () => {
    const { object, sent, values, updates } = createSequencer();
    object.create();

    object.onMessage({ type: 'bang' });
    object.onMessage({ type: 'bang' });

    expect(sent).toEqual([
      { data: { type: 'bang' }, options: { to: 0 } },
      { data: { type: 'bang' }, options: { to: 1 } }
    ]);
    expect(values).toMatchObject({ currentStep: 1, manualStep: 2 });
    expect(updates.at(-1)).toEqual({
      updates: { currentStep: 1, manualStep: 2 },
      options: { notifyUI: true }
    });
  });

  it('updates pattern data from messages and notifies the view', () => {
    const { object, values, updates } = createSequencer();
    object.create();

    object.onMessage({ type: 'setStep', track: 1, step: 2, on: true });

    expect((values.tracks as typeof TRACKS)[1].stepOn).toEqual([false, true, true, true]);
    expect(updates.at(-1)?.options).toEqual({ notifyUI: true });
  });

  it('reconfigures scheduling only when scheduler inputs change', () => {
    const { object, scheduler, values } = createSequencer();
    object.create();

    object.onMessage({ type: 'setStep', track: 0, step: 1, on: true });
    expect(scheduler.setup).not.toHaveBeenCalled();

    Object.assign(values, { swing: 25 });
    object.update();
    expect(scheduler.setup).toHaveBeenCalledOnce();
  });

  it('refreshes timeline markers when marker visibility changes', () => {
    const { object, scheduler, values } = createSequencer();
    object.create();

    object.onMessage({ type: 'mute' });

    expect(scheduler.setup).toHaveBeenCalledOnce();
    expect(scheduler.clearMarkers).toHaveBeenCalledOnce();
    expect(scheduler.dispose).not.toHaveBeenCalled();

    object.onMessage({ type: 'unmute' });
    expect(scheduler.setup).toHaveBeenCalledTimes(2);

    Object.assign(values, { showInTimeline: false });
    object.update();
    expect(scheduler.setup).toHaveBeenCalledTimes(3);
    expect(scheduler.clearMarkers).toHaveBeenCalledTimes(2);

    Object.assign(values, { showInTimeline: true });
    object.update();
    expect(scheduler.setup).toHaveBeenCalledTimes(4);
  });

  it('exposes the current dynamic outlet count and preserved handle IDs', () => {
    const { object } = createSequencer();

    expect(object.getOutlets().map((outlet) => outlet.handle)).toEqual([
      { handleId: 0 },
      { handleId: 1 }
    ]);
    expect(
      resolveMessageInlet(SequencerObject.inlets, {
        source: 'button-1',
        inletKey: 'message-in',
        outletKey: 'message-out'
      })
    ).toEqual({ inlet: 0, inletName: 'message' });
  });

  it('generates dynamic outlet documentation with existing handle IDs', () => {
    const objectSchema = schemaFromNode(SequencerObject, 'interface');

    expect(objectSchema.outlets[0].handle).toEqual({ handleId: 0 });
    expect(objectSchema.hasDynamicOutlets).toBe(true);
    expect(objectSchema.handlePatterns?.outlet?.template).toBe('out-{index}');
  });

  it('provides timeline colors from runtime data', () => {
    const { object, getStepColors } = createSequencer();
    object.create();

    expect(getStepColors(0)).toEqual(['#f00']);
  });
});
