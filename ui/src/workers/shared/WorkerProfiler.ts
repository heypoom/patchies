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
  measure<T>(nodeId: string, category: ProfilerCategory, fn: () => T): T {
    if (!this.enabled) {
      return fn();
    }

    const t0 = performance.now();
    const key = `${nodeId}|${category}`;

    const getCollector = (): ProfilerCollector => {
      let collector = this.collectors.get(key);
      if (!collector) {
        collector = new ProfilerCollector();
        this.collectors.set(key, collector);
      }
      return collector;
    };

    try {
      const result = fn();

      if (result instanceof Promise) {
        result.finally(() => {
          getCollector().record(performance.now() - t0);
        });
      } else {
        getCollector().record(performance.now() - t0);
      }

      return result;
    } catch (error) {
      getCollector().record(performance.now() - t0);
      throw error;
    }
  }

  private flushSync(): void {
    const now = performance.now();

    for (const [key, collector] of this.collectors) {
      const stats = collector.flush(now);
      if (stats.avg === 0 && stats.callsPerSecond === 0) continue;

      const sep = key.lastIndexOf('|');
      const nodeId = key.slice(0, sep);
      const category = key.slice(sep + 1) as ProfilerCategory;
      this.onFlush(nodeId, category, stats);
    }
  }

  private startFlush(): void {
    if (this.flushInterval !== null) return;

    this.flushInterval = setInterval(() => this.flushSync(), FLUSH_INTERVAL_MS);
  }

  private stopFlush(): void {
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    try {
      this.flushSync();
    } catch {
      // Ignore errors during final flush
    }

    this.collectors.clear();
  }
}
