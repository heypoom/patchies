import type { TimingStats } from './types';

const CAPACITY = 64;

/**
 * Per-node ring buffer of timing samples.
 * Uses pre-allocated Float64Array — zero allocation in the record() hot path.
 */
export class ProfilerCollector {
  private readonly samples = new Float64Array(CAPACITY);
  private head = 0;
  private count = 0;
  private messagesSinceFlush = 0;
  private lastFlushTime = performance.now();

  record(durationMs: number): void {
    this.samples[this.head] = durationMs;
    this.head = (this.head + 1) % CAPACITY;

    if (this.count < CAPACITY) this.count++;

    this.messagesSinceFlush++;
  }

  flush(now: number): TimingStats {
    const elapsed = (now - this.lastFlushTime) / 1000;
    const callsPerSecond = elapsed > 0 ? this.messagesSinceFlush / elapsed : 0;

    this.messagesSinceFlush = 0;
    this.lastFlushTime = now;

    if (this.count === 0) {
      return { avg: 0, max: 0, p95: 0, last: 0, callsPerSecond: 0 };
    }

    // Build a sorted copy for percentile (allocating here is fine — flush runs every 500ms)
    const sorted = new Float64Array(this.count);
    let sum = 0;
    let max = 0;

    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + CAPACITY) % CAPACITY;
      const v = this.samples[idx];

      sorted[i] = v;
      sum += v;

      if (v > max) max = v;
    }

    sorted.sort();

    const last = this.samples[(this.head - 1 + CAPACITY) % CAPACITY];
    const p95 = sorted[Math.floor(this.count * 0.95)];

    return { avg: sum / this.count, max, p95, last, callsPerSecond };
  }

  reset(): void {
    this.head = 0;
    this.count = 0;
    this.messagesSinceFlush = 0;
    this.lastFlushTime = performance.now();
  }
}
