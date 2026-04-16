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
  wasm_take_midi_message
} from '../wasm/anupars.js';

import { WorkerProfiler } from '$workers/shared/WorkerProfiler';
import type { ProfilerCategory, TimingStats } from '$lib/profiler/types';

export type WorkerInMessage =
  | { type: 'init'; cols: number; rows: number }
  | { type: 'sendKey'; key: string }
  | { type: 'sendMouse'; kind: number; button: number; col: number; row: number }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'profilerEnable'; nodeId: string; enabled: boolean };

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

// Frame loop runs inside the worker via setInterval
let loopId: ReturnType<typeof setInterval> | null = null;
let lastTs = performance.now();

const STEP_INTERVAL_MS = 1000 / 60;
const RENDER_INTERVAL_MS = 1000 / 30;
let lastRenderTs = 0;

function tick() {
  if (!initialized) return;

  const now = performance.now();
  const elapsed = now - lastTs;

  lastTs = now;

  // Step the sequencer
  workerProfiler.measure(nodeId, 'interval', () => {
    wasm_step(elapsed);
  });

  // Drain MIDI messages
  const midi: number[][] = [];
  let msg: Uint8Array | undefined;

  while ((msg = wasm_take_midi_message()) !== undefined) {
    midi.push([msg[0], msg[1], msg[2]]);
  }

  // Throttle render to ~30fps
  let ansi = '';

  if (now - lastRenderTs >= RENDER_INTERVAL_MS) {
    lastRenderTs = now;

    workerProfiler.measure(nodeId, 'draw', () => {
      ansi = wasm_render();
    });
  }

  // Only post if there's something to send
  if (midi.length > 0 || ansi.length > 0) {
    self.postMessage({ type: 'frame', ansi, midi } satisfies WorkerOutMessage);
  }
}

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init': {
      try {
        await initWasm();

        wasm_init(msg.cols, msg.rows);
        initialized = true;
        lastTs = performance.now();

        // Run at ~60fps
        loopId = setInterval(tick, STEP_INTERVAL_MS);

        self.postMessage({ type: 'ready' } satisfies WorkerOutMessage);
      } catch (err) {
        self.postMessage({
          type: 'error',
          message: String(err)
        } satisfies WorkerOutMessage);
      }

      break;
    }

    case 'sendKey': {
      if (initialized) wasm_send_key(msg.key);
      break;
    }

    case 'sendMouse': {
      if (initialized) wasm_send_mouse(msg.kind, msg.button, msg.col, msg.row);
      break;
    }

    case 'resize': {
      if (initialized) wasm_resize(msg.cols, msg.rows);
      break;
    }

    case 'profilerEnable': {
      nodeId = msg.nodeId;
      workerProfiler.setEnabled(msg.enabled);
      break;
    }
  }
};
