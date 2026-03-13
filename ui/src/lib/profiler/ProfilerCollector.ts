import type { TimingStats } from './types';

/** Default capacity — overridden by ProfilerCoordinator based on settings. */
export const DEFAULT_CAPACITY = 1200;

/**
 * Per-node ring buffer of timing samples.
 * Uses pre-allocated Float64Array — zero allocation in the record() hot path.
 *
 * Stats are split by purpose:
 * - `avg`, `last`: computed over samples since last flush (responsive to update rate)
 * - `max`, `p95`: computed over the full buffer (keeps spikes visible for the sample window)
 */
export class ProfilerCollector {
  private samples: Float64Array;
  private capacity: number;
  private head = 0;
  private count = 0;
  private messagesSinceFlush = 0;
  private lastFlushTime = performance.now();

  constructor(capacity: number = DEFAULT_CAPACITY) {
    this.capacity = capacity;
    this.samples = new Float64Array(capacity);
  }

  record(durationMs: number): void {
    this.samples[this.head] = durationMs;
    this.head = (this.head + 1) % this.capacity;

    if (this.count < this.capacity) this.count++;

    this.messagesSinceFlush++;
  }

  flush(now: number): TimingStats {
    const elapsed = (now - this.lastFlushTime) / 1000;
    const callsPerSecond = elapsed > 0 ? this.messagesSinceFlush / elapsed : 0;
    const recentCount = this.messagesSinceFlush;

    this.messagesSinceFlush = 0;
    this.lastFlushTime = now;

    if (this.count === 0) {
      return { avg: 0, max: 0, p95: 0, last: 0, callsPerSecond: 0 };
    }

    // max and p95: scan the full ring buffer (long window for spike visibility)
    const sorted = new Float64Array(this.count);
    let max = 0;

    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + this.capacity) % this.capacity;
      const v = this.samples[idx];

      sorted[i] = v;

      if (v > max) max = v;
    }

    sorted.sort();

    const p95 = sorted[Math.floor(this.count * 0.95)];
    const last = this.samples[(this.head - 1 + this.capacity) % this.capacity];

    // avg: only over samples since last flush (responsive to update rate)
    let avg = 0;

    if (recentCount > 0) {
      let recentSum = 0;

      for (let i = 0; i < recentCount; i++) {
        const idx = (this.head - recentCount + i + this.capacity) % this.capacity;
        recentSum += this.samples[idx];
      }

      avg = recentSum / recentCount;
    }

    return { avg, max, p95, last, callsPerSecond };
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
    this.messagesSinceFlush = 0;
    this.lastFlushTime = performance.now();
  }
}
