/**
 * WorkletBufferRegistry — shared global registry for named audio buffers
 * accessible by all AudioWorklet processors.
 *
 * Lives in `globalThis.__bufferRegistry` (same pattern as workletChannel).
 * All processors on the same AudioContext share one AudioWorkletGlobalScope,
 * so read/write access is direct — no message passing, no locks.
 *
 * Usage in processor files:
 *   import { workletBufferRegistry } from './worklet-buffer-registry';
 *   workletBufferRegistry.writeSample('mybuf', 0, sample);
 *   const val = workletBufferRegistry.readSample('mybuf', 0, index);
 */

export interface BufferEntry {
  /** The underlying storage — SAB-backed or regular */
  data: Float32Array;
  /** Logical length per channel */
  length: number;
  /** Number of channels (default 1) — data is interleaved: [ch0_s0, ch1_s0, ch0_s1, ch1_s1, ...] */
  channels: number;
  /** Circular write head position (sample index, not byte) */
  writeHead: number;
}

interface WorkletBufferRegistry {
  /** Create a named buffer. If sab is provided, wraps it; otherwise allocates a regular Float32Array. */
  create(name: string, length: number, channels?: number, sab?: SharedArrayBuffer): void;

  /** Delete a named buffer */
  delete(name: string): void;

  /** Get a buffer entry by name */
  get(name: string): BufferEntry | undefined;

  /** Check if a buffer exists */
  has(name: string): boolean;

  /** Write a single sample at writeHead for a channel, advance head (circular) */
  writeSample(name: string, channel: number, value: number): void;

  /** Write a block of mono samples starting at writeHead (advances head) */
  writeBlock(name: string, channel: number, samples: Float32Array): void;

  /** Read sample at absolute index (with wrapping) */
  readSample(name: string, channel: number, index: number): number;

  /** Read with 4-point Hermite interpolation */
  readInterpolated(name: string, channel: number, index: number): number;

  /** Reset write head to 0 */
  resetHead(name: string): void;

  /** List all buffer names */
  list(): string[];
}

declare let globalThis: {
  __bufferRegistry?: WorkletBufferRegistry;
};

function createWorkletBufferRegistry(): WorkletBufferRegistry {
  const buffers = new Map<string, BufferEntry>();

  return {
    create(name, length, channels = 1, sab?) {
      let data: Float32Array;
      let actualLength: number;

      if (sab) {
        data = new Float32Array(sab);
        // Derive length from the SAB's actual capacity to avoid OOB access
        actualLength = sab.byteLength / Float32Array.BYTES_PER_ELEMENT / channels;
      } else {
        const totalSamples = length * channels;
        data = new Float32Array(totalSamples);
        actualLength = length;
      }

      buffers.set(name, { data, length: actualLength, channels, writeHead: 0 });
    },

    delete(name) {
      buffers.delete(name);
    },

    get(name) {
      return buffers.get(name);
    },

    has(name) {
      return buffers.has(name);
    },

    writeSample(name, channel, value) {
      const entry = buffers.get(name);
      if (!entry) return;

      const idx = entry.writeHead * entry.channels + channel;
      entry.data[idx] = value;

      // Only advance head when writing the last channel
      if (channel === entry.channels - 1) {
        entry.writeHead = (entry.writeHead + 1) % entry.length;
      }
    },

    writeBlock(name, channel, samples) {
      const entry = buffers.get(name);
      if (!entry) return;

      const len = entry.length;
      const ch = entry.channels;

      for (let i = 0; i < samples.length; i++) {
        const sampleIdx = (entry.writeHead + i) % len;
        entry.data[sampleIdx * ch + channel] = samples[i];
      }

      // Advance head by block size (only once, caller handles per-channel)
      if (channel === ch - 1 || ch === 1) {
        entry.writeHead = (entry.writeHead + samples.length) % len;
      }
    },

    readSample(name, channel, index) {
      const entry = buffers.get(name);
      if (!entry) return 0;

      const wrappedIdx = (((index | 0) % entry.length) + entry.length) % entry.length;
      return entry.data[wrappedIdx * entry.channels + channel];
    },

    readInterpolated(name, channel, index) {
      const entry = buffers.get(name);
      if (!entry) return 0;

      const len = entry.length;
      const ch = entry.channels;
      const data = entry.data;

      // 4-point Hermite interpolation
      const intIdx = Math.floor(index);
      const frac = index - intIdx;

      const wrap = (i: number) => ((i % len) + len) % len;

      const y0 = data[wrap(intIdx - 1) * ch + channel];
      const y1 = data[wrap(intIdx) * ch + channel];
      const y2 = data[wrap(intIdx + 1) * ch + channel];
      const y3 = data[wrap(intIdx + 2) * ch + channel];

      // Hermite basis functions
      const c0 = y1;
      const c1 = 0.5 * (y2 - y0);
      const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
      const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);

      return ((c3 * frac + c2) * frac + c1) * frac + c0;
    },

    resetHead(name) {
      const entry = buffers.get(name);
      if (entry) entry.writeHead = 0;
    },

    list() {
      return Array.from(buffers.keys());
    }
  };
}

// Lazy init: first bundled module to load creates the registry, rest reuse
if (!globalThis.__bufferRegistry) {
  globalThis.__bufferRegistry = createWorkletBufferRegistry();
}

export const workletBufferRegistry: WorkletBufferRegistry = globalThis.__bufferRegistry;
