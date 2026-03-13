import { ProfilerCollector } from './ProfilerCollector';
import { HOT_THRESHOLD_MS } from './types';
import type {
  NodeProfileEntry,
  ProfilerCategory,
  ProfilerSnapshot,
  RenderFrameStats,
  TimingStats
} from './types';

const HISTORY_CAPACITY = 120; // 120 × 500ms = 60 seconds
const FLUSH_INTERVAL_MS = 500;

interface NodeCollectors {
  /** Collector per timing category — created on demand */
  collectors: Partial<Record<ProfilerCategory, ProfilerCollector>>;
  type: string;
}

/**
 * Coordinates per-node timing data on the main thread.
 * Aggregates samples every 500ms and maintains a 60-second history ring buffer.
 */
export class ProfilerCoordinator {
  private static instance: ProfilerCoordinator | null = null;

  private nodes = new Map<string, NodeCollectors>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onSnapshot: ((snapshot: ProfilerSnapshot) => void) | null = null;

  // 60-second history ring buffer (plain objects, not reactive)
  private history: (ProfilerSnapshot | null)[] = new Array(HISTORY_CAPACITY).fill(null);
  private historyHead = 0;
  private historyCount = 0;

  // Latest render frame stats from the render worker
  private latestRenderFrame: RenderFrameStats | null = null;

  // Enable-change listeners (used to broadcast to workers)
  private enableListeners: ((enabled: boolean) => void)[] = [];

  static getInstance(): ProfilerCoordinator {
    if (!ProfilerCoordinator.instance) {
      ProfilerCoordinator.instance = new ProfilerCoordinator();
    }
    return ProfilerCoordinator.instance;
  }

  /**
   * Record a timing sample for a node under the given category.
   */
  record(nodeId: string, type: string, category: ProfilerCategory, durationMs: number): void {
    this.getCollector(nodeId, type, category).record(durationMs);
  }

  /**
   * Merge a worker-side timing stat into the coordinator.
   * The worker has already done its own ring-buffer aggregation, so we inject
   * the avg as a single sample.
   */
  recordWorkerStats(
    nodeId: string,
    type: string,
    category: ProfilerCategory,
    stats: TimingStats
  ): void {
    if (stats.avg > 0) {
      this.getCollector(nodeId, type, category).record(stats.avg);
    }
  }

  /** Store the latest render frame stats received from the render worker. */
  recordRenderFrameStats(stats: RenderFrameStats): void {
    this.latestRenderFrame = stats;
  }

  /** Remove a node's collectors when the node is deleted. */
  unregister(nodeId: string): void {
    this.nodes.delete(nodeId);
  }

  /** Register a listener that fires when the enabled state changes (used to notify workers). */
  onEnableChange(listener: (enabled: boolean) => void): void {
    this.enableListeners.push(listener);
  }

  /** Notify all enable-change listeners. Called from profiler.store.ts. */
  notifyEnableChange(enabled: boolean): void {
    for (const listener of this.enableListeners) {
      listener(enabled);
    }
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
    this.nodes.clear();
    this.latestRenderFrame = null;
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

  private getCollector(
    nodeId: string,
    type: string,
    category: ProfilerCategory
  ): ProfilerCollector {
    let entry = this.nodes.get(nodeId);
    if (!entry) {
      entry = { collectors: {}, type };
      this.nodes.set(nodeId, entry);
    }
    if (!entry.collectors[category]) {
      entry.collectors[category] = new ProfilerCollector();
    }
    return entry.collectors[category]!;
  }

  private flush(): void {
    const now = performance.now();
    const entries: NodeProfileEntry[] = [];

    for (const [nodeId, { collectors, type }] of this.nodes) {
      const timings: Partial<Record<ProfilerCategory, TimingStats>> = {};
      let hasActivity = false;

      for (const [cat, collector] of Object.entries(collectors) as [
        ProfilerCategory,
        ProfilerCollector
      ][]) {
        if (!collector) continue;
        const stats = collector.flush(now);
        if (stats.avg > 0 || stats.callsPerSecond > 0) {
          timings[cat] = stats;
          hasActivity = true;
        }
      }

      if (!hasActivity) continue;

      // isHot if any category exceeds threshold
      const isHot = Object.values(timings).some((t) => t && t.avg > HOT_THRESHOLD_MS);

      entries.push({ nodeId, nodeType: type, timings, isHot });
    }

    // Sort by message avg → draw avg → highest other category avg
    entries.sort((a, b) => {
      const aAvg =
        a.timings.message?.avg ??
        a.timings.draw?.avg ??
        Math.max(...Object.values(a.timings).map((t) => t?.avg ?? 0));
      const bAvg =
        b.timings.message?.avg ??
        b.timings.draw?.avg ??
        Math.max(...Object.values(b.timings).map((t) => t?.avg ?? 0));
      return bAvg - aAvg;
    });

    const snapshot: ProfilerSnapshot = {
      timestamp: now,
      entries,
      ...(this.latestRenderFrame && { renderFrame: this.latestRenderFrame })
    };

    // Push to history ring buffer
    this.history[this.historyHead] = snapshot;
    this.historyHead = (this.historyHead + 1) % HISTORY_CAPACITY;
    if (this.historyCount < HISTORY_CAPACITY) this.historyCount++;

    this.onSnapshot?.(snapshot);
  }
}
