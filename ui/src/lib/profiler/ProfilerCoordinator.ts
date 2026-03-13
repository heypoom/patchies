import { ProfilerCollector } from './ProfilerCollector';
import { HOT_THRESHOLD_MS } from './types';
import type { NodeProfileEntry, ProfilerSnapshot } from './types';

const HISTORY_CAPACITY = 120; // 120 × 500ms = 60 seconds
const FLUSH_INTERVAL_MS = 500;

/**
 * Coordinates per-node timing data on the main thread.
 * Aggregates samples every 500ms and maintains a 60-second history ring buffer.
 */
export class ProfilerCoordinator {
  private static instance: ProfilerCoordinator | null = null;

  private collectors = new Map<string, { collector: ProfilerCollector; type: string }>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onSnapshot: ((snapshot: ProfilerSnapshot) => void) | null = null;

  // 60-second history ring buffer (plain objects, not reactive)
  private history: (ProfilerSnapshot | null)[] = new Array(HISTORY_CAPACITY).fill(null);
  private historyHead = 0;
  private historyCount = 0;

  static getInstance(): ProfilerCoordinator {
    if (!ProfilerCoordinator.instance) {
      ProfilerCoordinator.instance = new ProfilerCoordinator();
    }
    return ProfilerCoordinator.instance;
  }

  /**
   * Record a timing sample for a node.
   * Called from ObjectService — only when profiler.enabled is true.
   */
  record(nodeId: string, type: string, durationMs: number): void {
    let entry = this.collectors.get(nodeId);
    if (!entry) {
      entry = { collector: new ProfilerCollector(), type };
      this.collectors.set(nodeId, entry);
    }
    entry.collector.record(durationMs);
  }

  /** Remove a node's collector when the node is deleted. */
  unregister(nodeId: string): void {
    this.collectors.delete(nodeId);
  }

  /** Start flushing and delivering snapshots. */
  start(onSnapshot: (snapshot: ProfilerSnapshot) => void): void {
    this.onSnapshot = onSnapshot;
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  /** Stop flushing and clear all collected data. */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.collectors.clear();
    this.history.fill(null);
    this.historyHead = 0;
    this.historyCount = 0;
    this.onSnapshot = null;
  }

  /** Get the last N history entries in chronological order. */
  getHistory(count: number): ProfilerSnapshot[] {
    const result: ProfilerSnapshot[] = [];
    const n = Math.min(count, this.historyCount);
    for (let i = 0; i < n; i++) {
      const idx = (this.historyHead - n + i + HISTORY_CAPACITY) % HISTORY_CAPACITY;
      const snap = this.history[idx];
      if (snap) result.push(snap);
    }
    return result;
  }

  private flush(): void {
    const now = performance.now();
    const entries: NodeProfileEntry[] = [];

    for (const [nodeId, { collector, type }] of this.collectors) {
      const stats = collector.flush(now);
      if (stats.callsPerSecond === 0 && stats.avg === 0) continue; // skip idle nodes
      entries.push({
        nodeId,
        nodeType: type,
        processingTime: stats,
        isHot: stats.avg > HOT_THRESHOLD_MS
      });
    }

    // Sort by avg descending
    entries.sort((a, b) => b.processingTime.avg - a.processingTime.avg);

    const snapshot: ProfilerSnapshot = { timestamp: now, entries };

    // Push to history ring buffer
    this.history[this.historyHead] = snapshot;
    this.historyHead = (this.historyHead + 1) % HISTORY_CAPACITY;
    if (this.historyCount < HISTORY_CAPACITY) this.historyCount++;

    this.onSnapshot?.(snapshot);
  }
}
