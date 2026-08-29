import type { ClockCommandMessage, TransportState } from '$lib/transport/types';
import type { PollingClockScheduler } from '$lib/transport/ClockScheduler';

type WorkerClockSource = {
  getLastTime: () => number;
  getTransportTime: () => TransportState | null;
};

/**
 * Creates the transport facade exposed to user render code in the worker.
 *
 * Rendering only supplies the current clock state.
 * Scheduling and transport commands live here.
 */
export const createWorkerClock = (scheduler: PollingClockScheduler, source: WorkerClockSource) => {
  const transport = () => source.getTransportTime();

  const send = (command: ClockCommandMessage['command']) =>
    self.postMessage({ type: 'clockCommand', command });

  return {
    get time() {
      return transport()?.seconds ?? source.getLastTime();
    },
    get ticks() {
      return transport()?.ticks ?? 0;
    },
    get beat() {
      return transport()?.beat ?? 0;
    },
    get phase() {
      return transport()?.phase ?? 0;
    },
    get bpm() {
      return transport()?.bpm ?? 120;
    },
    get isPlaying() {
      return transport()?.isPlaying ?? true;
    },
    get bar() {
      return transport()?.bar ?? 0;
    },
    get beatsPerBar() {
      return transport()?.beatsPerBar ?? 4;
    },
    get denominator() {
      return transport()?.denominator ?? 4;
    },
    subdiv(n: number) {
      const transportTime = transport();
      const ticks = transportTime?.ticks ?? 0;
      const ticksPerSubdiv = (transportTime?.ppq ?? 192) / n;

      return Math.floor((ticks % (transportTime?.ppq ?? 192)) / ticksPerSubdiv);
    },
    subdivPhase(n: number) {
      const transportTime = transport();
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
    onBeat: scheduler.onBeat.bind(scheduler),
    schedule: scheduler.schedule.bind(scheduler),
    every: scheduler.every.bind(scheduler),
    onPlayStateChange: scheduler.onPlayStateChange.bind(scheduler),
    cancel: scheduler.cancel.bind(scheduler),
    cancelAll: scheduler.cancelAll.bind(scheduler),

    setTimeSignature: (numerator: number, denominator = 4) =>
      send({ action: 'setTimeSignature', numerator, denominator })
  };
};

export function installWorkerTimeGlobal(getTime: () => number): void {
  Object.defineProperty(globalThis, 'time', { configurable: true, get: getTime });
}
