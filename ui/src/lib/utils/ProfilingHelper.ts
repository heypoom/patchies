/**
 * Helper class for accumulating and reporting performance profiling data.
 * Tracks timing data and periodically reports statistics (mean, median, p95, p99).
 */
export class ProfilingHelper {
  private samples: number[] = [];
  private lastReport: number = performance.now();
  private reportInterval: number;
  private label: string;

  constructor(label: string, reportIntervalMs: number = 3000) {
    this.label = label;
    this.reportInterval = reportIntervalMs;
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

    console.log(
      `[${this.label}] ${this.samples.length} samples: ` +
        `mean=${mean.toFixed(2)}ms, median=${median.toFixed(2)}ms, ` +
        `p95=${p95.toFixed(2)}ms, p99=${p99.toFixed(2)}ms, ` +
        `min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`
    );
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
}
