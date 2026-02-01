export interface ProfilingStats {
  label: string;
  sampleCount: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  lastUpdate: number;
}

type StatsCallback = (stats: ProfilingStats) => void;

// Global registry of all profilers
const globalProfilers = new Set<ProfilingHelper>();

/**
 * Helper class for accumulating and reporting performance profiling data.
 * Tracks timing data and periodically reports statistics (mean, median, p95, p99).
 */
export class ProfilingHelper {
  private samples: number[] = [];
  private lastReport: number = performance.now();
  private reportInterval: number;
  private label: string;
  private callbacks: Set<StatsCallback> = new Set();
  private latestStats: ProfilingStats | null = null;
  private isWorker: boolean;

  constructor(label: string, reportIntervalMs: number = 3000) {
    this.label = label;
    this.reportInterval = reportIntervalMs;
    // Check if running in a worker context
    this.isWorker = typeof self !== 'undefined' && 'importScripts' in self;
    globalProfilers.add(this);
  }

  /**
   * Subscribe to stats updates.
   */
  onStats(callback: StatsCallback): () => void {
    this.callbacks.add(callback);
    // Immediately call with latest stats if available
    if (this.latestStats) {
      callback(this.latestStats);
    }
    return () => this.callbacks.delete(callback);
  }

  /**
   * Get the latest stats snapshot.
   */
  getStats(): ProfilingStats | null {
    return this.latestStats;
  }

  /**
   * Get the label for this profiler.
   */
  getLabel(): string {
    return this.label;
  }

  /**
   * Record a timing sample.
   * @param durationMs - The duration in milliseconds
   */
  record(durationMs: number) {
    this.samples.push(durationMs);

    const now = performance.now();
    if (now - this.lastReport >= this.reportInterval) {
      this.report();
      this.reset();
      this.lastReport = now;
    }
  }

  /**
   * Report statistics and reset.
   */
  private report() {
    if (this.samples.length === 0) return;

    const sorted = [...this.samples].sort((a, b) => a - b);
    const mean = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    this.latestStats = {
      label: this.label,
      sampleCount: this.samples.length,
      mean,
      median,
      p95,
      p99,
      min,
      max,
      lastUpdate: performance.now()
    };

    // Notify subscribers
    this.callbacks.forEach((cb) => cb(this.latestStats!));

    // If in worker, post stats to main thread
    if (this.isWorker) {
      self.postMessage({
        type: 'profiling-stats',
        stats: this.latestStats
      });
    }
  }

  /**
   * Reset accumulated samples.
   */
  private reset() {
    this.samples = [];
  }

  /**
   * Force an immediate report (useful for debugging).
   */
  forceReport() {
    this.report();
    this.reset();
    this.lastReport = performance.now();
  }

  /**
   * Cleanup and remove from global registry.
   */
  destroy() {
    globalProfilers.delete(this);
    this.callbacks.clear();
  }
}

/**
 * Get all registered profilers.
 */
export function getAllProfilers(): ProfilingHelper[] {
  return Array.from(globalProfilers);
}
