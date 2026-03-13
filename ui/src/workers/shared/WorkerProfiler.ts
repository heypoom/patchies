import { ProfilerCollector } from '$lib/profiler/ProfilerCollector';
import type { ProfilerCategory, TimingStats } from '$lib/profiler/types';

const FLUSH_INTERVAL_MS = 500;

/**
 * Reusable profiler for Web Workers.
 *
 * Maintains per-node, per-category ring-buffer collectors and flushes stats every 500ms
 * via an `onFlush` callback so each worker can post them back to the main thread in its
 * own response envelope.
 *
 * Usage:
 *   const profiler = new WorkerProfiler((nodeId, category, stats) => {
 *     self.postMessage({ type: 'profilerStats', nodeId, category, stats });
 *   });
 *
 *   profiler.setEnabled(true);                        // call when main thread sends profilerEnable
 *   profiler.measure(nodeId, 'message', () => { … }); // wraps a callback with optional timing
 */
export class WorkerProfiler {
  private enabled = false;
  /** key: `${nodeId}|${category}` */
  private collectors = new Map<string, ProfilerCollector>();
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly onFlush: (
      nodeId: string,
      category: ProfilerCategory,
      stats: TimingStats
    ) => void
  ) {}

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
   * Run `fn`, record its duration under the given category, and return.
   * When disabled, calls `fn` directly with no overhead.
   */
  measure(nodeId: string, category: ProfilerCategory, fn: () => void): void {
    if (!this.enabled) {
      fn();
      return;
    }

    const t0 = performance.now();
    fn();

    const key = `${nodeId}|${category}`;
    let collector = this.collectors.get(key);
    if (!collector) {
      collector = new ProfilerCollector();
      this.collectors.set(key, collector);
    }
    collector.record(performance.now() - t0);
  }

  private startFlush(): void {
    if (this.flushInterval !== null) return;

    this.flushInterval = setInterval(() => {
      const now = performance.now();

      for (const [key, collector] of this.collectors) {
        const stats = collector.flush(now);
        if (stats.avg === 0 && stats.callsPerSecond === 0) continue;

        const sep = key.lastIndexOf('|');
        const nodeId = key.slice(0, sep);
        const category = key.slice(sep + 1) as ProfilerCategory;
        this.onFlush(nodeId, category, stats);
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
