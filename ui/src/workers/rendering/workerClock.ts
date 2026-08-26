import type { ClockCommandMessage, TransportState } from '$lib/transport/types';
import type { PollingClockScheduler } from '$lib/transport/ClockScheduler';

type WorkerClockSource = {
  getTransportTime: () => TransportState | null;
  getLastTime: () => number;
};

/**
 * Creates the transport facade exposed to user render code in the worker.
 * Rendering only supplies the current clock state; scheduling and transport
 * commands live here so they can evolve independently of the FBO pipeline.
 */
export const createWorkerClock = (scheduler: PollingClockScheduler, source: WorkerClockSource) => {
  const getTransportTime = () => source.getTransportTime();
  const send = (command: ClockCommandMessage['command']) =>
    self.postMessage({ type: 'clockCommand', command });

  return {
    get time() {
      return getTransportTime()?.seconds ?? source.getLastTime();
    },
    get ticks() {
      return getTransportTime()?.ticks ?? 0;
    },
    get beat() {
      return getTransportTime()?.beat ?? 0;
    },
    get phase() {
      return getTransportTime()?.phase ?? 0;
    },
    get bpm() {
      return getTransportTime()?.bpm ?? 120;
    },
    get isPlaying() {
      return getTransportTime()?.isPlaying ?? true;
    },
    get bar() {
      return getTransportTime()?.bar ?? 0;
    },
    get beatsPerBar() {
      return getTransportTime()?.beatsPerBar ?? 4;
    },
    get denominator() {
      return getTransportTime()?.denominator ?? 4;
    },
    subdiv(n: number) {
      const transportTime = getTransportTime();
      const ticks = transportTime?.ticks ?? 0;
      const ticksPerSubdiv = (transportTime?.ppq ?? 192) / n;

      return Math.floor((ticks % (transportTime?.ppq ?? 192)) / ticksPerSubdiv);
    },
    subdivPhase(n: number) {
      const transportTime = getTransportTime();
      const ticks = transportTime?.ticks ?? 0;
      const ppq = transportTime?.ppq ?? 192;
      const ticksPerSubdiv = ppq / n;

      return ((ticks % ppq) % ticksPerSubdiv) / ticksPerSubdiv;
    },
    play: () => send({ action: 'play' }),
    pause: () => send({ action: 'pause' }),
    stop: () => send({ action: 'stop' }),
    seek: (time: number) => send({ action: 'seek', value: time }),
    setBpm: (bpm: number) => send({ action: 'setBpm', value: bpm }),
    setTimeSignature: (numerator: number, denominator = 4) =>
      send({ action: 'setTimeSignature', numerator, denominator }),
    onBeat: scheduler.onBeat.bind(scheduler),
    schedule: scheduler.schedule.bind(scheduler),
    every: scheduler.every.bind(scheduler),
    onPlayStateChange: scheduler.onPlayStateChange.bind(scheduler),
    cancel: scheduler.cancel.bind(scheduler),
    cancelAll: scheduler.cancelAll.bind(scheduler)
  };
};

export const installWorkerTimeGlobal = (getTime: () => number): void => {
  Object.defineProperty(globalThis, 'time', {
    configurable: true,
    get: getTime
  });
};
