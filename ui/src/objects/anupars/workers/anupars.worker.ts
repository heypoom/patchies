/**
 * Web Worker for anupars WASM execution.
 * Runs wasm_step + MIDI drain + wasm_render off the main thread.
 * Posts MIDI messages and ANSI render strings back.
 */

import initWasm, {
  wasm_init,
  wasm_step,
  wasm_send_key,
  wasm_send_mouse,
  wasm_render,
  wasm_resize,
  wasm_take_midi_message,
  wasm_load_file,
  wasm_set_input
} from '../wasm/anupars.js';

import { WorkerProfiler } from '$workers/shared/WorkerProfiler';
import type { ProfilerCategory, TimingStats } from '$lib/profiler/types';
import { match } from 'ts-pattern';

export type WorkerInMessage =
  | { type: 'init'; cols: number; rows: number }
  | { type: 'sendKey'; key: string }
  | { type: 'sendMouse'; kind: number; button: number; col: number; row: number }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'profilerEnable'; nodeId: string; enabled: boolean }
  | { type: 'setFpsCap'; fpsCap: number }
  | { type: 'setFrozen'; frozen: boolean }
  | { type: 'loadFile'; contents: string }
  | { type: 'setPattern'; pattern: string };

export type WorkerOutMessage =
  | { type: 'ready' }
  | { type: 'frame'; ansi: string; midi: number[][] }
  | { type: 'profilerStats'; nodeId: string; category: ProfilerCategory; stats: TimingStats }
  | { type: 'error'; message: string };

let initialized = false;
let nodeId = '';

// Profiler
const workerProfiler = new WorkerProfiler((id, category, stats) => {
  self.postMessage({
    type: 'profilerStats',
    nodeId: id,
    category,
    stats
  } satisfies WorkerOutMessage);
});

// Frame loop uses recursive setTimeout to avoid tick stacking.
// Unlike setInterval, this ensures the next tick is only scheduled
// after the current one completes, preventing frame pile-ups.
let loopId: ReturnType<typeof setTimeout> | null = null;
let lastTs = performance.now();
let tickIntervalMs = 1000 / 60;
let frozen = false;

function restartLoop() {
  if (loopId !== null) {
    clearTimeout(loopId);
    loopId = null;
  }

  if (initialized && !frozen) {
    scheduleTick();
  }
}

function scheduleTick() {
  loopId = setTimeout(tick, tickIntervalMs);
}

function tick() {
  loopId = null;
  if (!initialized || frozen) return;

  const now = performance.now();
  const elapsed = now - lastTs;

  lastTs = now;

  workerProfiler.measure(nodeId, 'interval', () => {
    wasm_step(elapsed);
  });

  // Drain MIDI messages
  const midi: number[][] = [];
  let msg: Uint8Array | undefined;

  while ((msg = wasm_take_midi_message()) !== undefined) {
    midi.push(Array.from(msg));
  }

  // Render ANSI output
  let ansi = '';

  workerProfiler.measure(nodeId, 'draw', () => {
    ansi = wasm_render();
  });

  if (midi.length > 0 || ansi.length > 0) {
    self.postMessage({ type: 'frame', ansi, midi } satisfies WorkerOutMessage);
  }

  // Schedule next tick after current one completes (avoids stacking)
  scheduleTick();
}

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  await match(msg)
    .with({ type: 'init' }, async (m) => {
      try {
        await initWasm();

        wasm_init(m.cols, m.rows);
        initialized = true;
        lastTs = performance.now();

        restartLoop();

        self.postMessage({ type: 'ready' } satisfies WorkerOutMessage);
      } catch (err) {
        self.postMessage({
          type: 'error',
          message: String(err)
        } satisfies WorkerOutMessage);
      }
    })
    .with({ type: 'sendKey' }, (m) => {
      if (initialized) wasm_send_key(m.key);
    })
    .with({ type: 'sendMouse' }, (m) => {
      if (initialized) wasm_send_mouse(m.kind, m.button, m.col, m.row);
    })
    .with({ type: 'resize' }, (m) => {
      if (initialized) wasm_resize(m.cols, m.rows);
    })
    .with({ type: 'profilerEnable' }, (m) => {
      nodeId = m.nodeId;
      workerProfiler.setEnabled(m.enabled);
    })
    .with({ type: 'setFpsCap' }, (m) => {
      // 0 = unlimited → default 60fps
      tickIntervalMs = 1000 / (m.fpsCap || 60);
      restartLoop();
    })
    .with({ type: 'setFrozen' }, (m) => {
      frozen = m.frozen;
      restartLoop();
    })
    .with({ type: 'loadFile' }, (m) => {
      if (initialized) wasm_load_file(m.contents);
    })
    .with({ type: 'setPattern' }, (m) => {
      if (initialized) wasm_set_input(m.pattern);
    })
    .exhaustive();
};
