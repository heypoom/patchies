import { ProfilerCollector } from '$lib/profiler/ProfilerCollector';
import type { TimingStats } from '$lib/profiler/types';

const FLUSH_INTERVAL_MS = 500;

/**
 * Reusable profiler for Web Workers.
 *
 * Maintains per-node ring-buffer collectors and flushes stats every 500ms via an
 * `onFlush` callback so each worker can post them back to the main thread in its
 * own response envelope.
 *
 * Usage:
 *   const profiler = new WorkerProfiler((nodeId, stats) => {
 *     self.postMessage({ type: 'profilerStats', nodeId, messageStats: stats });
 *   });
 *
 *   profiler.setEnabled(true);          // call when main thread sends profilerEnable
 *   profiler.measure(nodeId, () => { … }); // wraps a callback with optional timing
 */
export class WorkerProfiler {
  private enabled = false;
  private collectors = new Map<string, ProfilerCollector>();
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly onFlush: (nodeId: string, stats: TimingStats) => void) {}

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (enabled) {
      this.startFlush();
    } else {
      this.stopFlush();
    }
  }

  /**
   * Run `fn` and record its duration.
   * When disabled, calls `fn` directly with no overhead.
   */
  measure(nodeId: string, fn: () => void): void {
    if (!this.enabled) {
      fn();
      return;
    }

    const t0 = performance.now();

    fn();

    let collector = this.collectors.get(nodeId);

    if (!collector) {
      collector = new ProfilerCollector();

      this.collectors.set(nodeId, collector);
    }

    collector.record(performance.now() - t0);
  }

  private startFlush(): void {
    if (this.flushInterval !== null) return;

    this.flushInterval = setInterval(() => {
      const now = performance.now();

      for (const [nodeId, collector] of this.collectors) {
        const stats = collector.flush(now);
        if (stats.avg === 0 && stats.callsPerSecond === 0) continue;

        this.onFlush(nodeId, stats);
      }
    }, FLUSH_INTERVAL_MS);
  }

  private stopFlush(): void {
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval);

      this.flushInterval = null;
    }

    this.collectors.clear();
  }
}
