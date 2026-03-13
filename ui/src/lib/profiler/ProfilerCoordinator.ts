import { ProfilerCollector, DEFAULT_CAPACITY } from './ProfilerCollector';
import type {
  NodeProfileEntry,
  ProfilerCategory,
  ProfilerSnapshot,
  RenderFrameStats,
  TimingStats
} from './types';

const HISTORY_CAPACITY = 120; // ring buffer entries (adjusts with flush interval)

export interface ProfilerConfig {
  /** Ring buffer capacity per collector (samples). Larger = spikes stay in max longer. */
  sampleCapacity: number;
  /** How often stats are flushed and the UI is updated (ms). */
  flushIntervalMs: number;
  /** Average ms above which a node is flagged as hot. */
  hotThresholdMs: number;
}

export const DEFAULT_CONFIG: ProfilerConfig = {
  sampleCapacity: DEFAULT_CAPACITY,
  flushIntervalMs: 500,
  hotThresholdMs: 2
};

interface NodeCollectors {
  type: string;

  /** Collector per timing category — created on demand */
  collectors: Partial<Record<ProfilerCategory, ProfilerCollector>>;

  /** Latest worker-side TimingStats per category, consumed on each flush */
  workerStats: Partial<Record<ProfilerCategory, TimingStats>>;

  /** Smoothed sort key (EMA) — prevents sort order from jumping between flushes */
  sortKey: number;
}

/**
 * Coordinates per-node timing data on the main thread.
 * Aggregates samples periodically and maintains a history ring buffer.
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

  // Current configuration
  private config: ProfilerConfig = { ...DEFAULT_CONFIG };

  static getInstance(): ProfilerCoordinator {
    if (!ProfilerCoordinator.instance) {
      ProfilerCoordinator.instance = new ProfilerCoordinator();
    }

    return ProfilerCoordinator.instance;
  }

  /** Get current hot threshold */
  get hotThresholdMs(): number {
    return this.config.hotThresholdMs;
  }

  /** Update profiler configuration. Restarts flush interval if running. */
  setConfig(partial: Partial<ProfilerConfig>): void {
    const prev = { ...this.config };
    Object.assign(this.config, partial);

    // If capacity changed, recreate all collectors
    if (partial.sampleCapacity && partial.sampleCapacity !== prev.sampleCapacity) {
      for (const entry of this.nodes.values()) {
        const newCollectors: Partial<Record<ProfilerCategory, ProfilerCollector>> = {};

        for (const cat of Object.keys(entry.collectors) as ProfilerCategory[]) {
          newCollectors[cat] = new ProfilerCollector(this.config.sampleCapacity);
        }

        entry.collectors = newCollectors;
      }
    }

    // If flush interval changed and we're running, restart the interval
    if (partial.flushIntervalMs && partial.flushIntervalMs !== prev.flushIntervalMs) {
      if (this.intervalId !== null) {
        clearInterval(this.intervalId);
        this.intervalId = setInterval(() => this.flush(), this.config.flushIntervalMs);
      }
    }
  }

  /**
   * Record a timing sample for a node under the given category.
   */
  record(nodeId: string, type: string, category: ProfilerCategory, durationMs: number): void {
    this.getCollector(nodeId, type, category).record(durationMs);
  }

  /**
   * Merge a worker-side timing stat into the coordinator.
   * The full TimingStats (min/avg/max/callsPerSecond) is stored and emitted
   * directly in the next flush rather than being re-sampled through a collector.
   */
  recordWorkerStats(
    nodeId: string,
    type: string,
    category: ProfilerCategory,
    stats: TimingStats
  ): void {
    let entry = this.nodes.get(nodeId);

    if (!entry) {
      entry = { collectors: {}, type, workerStats: {}, sortKey: 0 };
      this.nodes.set(nodeId, entry);
    }

    entry.workerStats[category] = stats;
  }

  /** Store the latest render frame stats received from the render worker. */
  recordRenderFrameStats(stats: RenderFrameStats): void {
    this.latestRenderFrame = stats;
  }

  /** Remove a node's collectors when the node is deleted. */
  unregister(nodeId: string): void {
    this.nodes.delete(nodeId);
  }

  /** Register a listener that fires when the enabled state changes (used to notify workers).
   * Returns an unsubscribe function — call it to deregister the listener on teardown. */
  onEnableChange(listener: (enabled: boolean) => void): () => void {
    this.enableListeners.push(listener);

    return () => {
      const idx = this.enableListeners.indexOf(listener);
      if (idx > -1) this.enableListeners.splice(idx, 1);
    };
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

    this.intervalId = setInterval(() => this.flush(), this.config.flushIntervalMs);
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
      entry = { collectors: {}, type, workerStats: {}, sortKey: 0 };
      this.nodes.set(nodeId, entry);
    }

    if (!entry.collectors[category]) {
      entry.collectors[category] = new ProfilerCollector(this.config.sampleCapacity);
    }

    return entry.collectors[category]!;
  }

  private flush(): void {
    const now = performance.now();
    const entries: NodeProfileEntry[] = [];
    const hotThreshold = this.config.hotThresholdMs;

    for (const [nodeId, entry] of this.nodes) {
      const { collectors, type, workerStats } = entry;
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

      // Merge worker-side stats (preserves min/max/callsPerSecond from the worker)
      for (const [cat, stats] of Object.entries(workerStats) as [ProfilerCategory, TimingStats][]) {
        if (!stats) continue;

        if (stats.avg > 0 || stats.callsPerSecond > 0) {
          timings[cat] = stats;
          hasActivity = true;
        }
      }

      // Keep workerStats until the worker sends fresh data (don't clear —
      // the worker may flush less frequently than the coordinator)

      // isHot if any non-init category exceeds threshold
      const isHot = hasActivity
        ? (Object.entries(timings) as [ProfilerCategory, TimingStats][]).some(
            ([cat, t]) => cat !== 'init' && t.avg > hotThreshold
          )
        : false;

      // Update smoothed sort key (EMA with α=0.3 for stability)
      const instantKey =
        timings.message?.avg ??
        timings.draw?.avg ??
        Math.max(...Object.values(timings).map((t) => t?.avg ?? 0), 0);
      entry.sortKey = entry.sortKey === 0 ? instantKey : entry.sortKey * 0.7 + instantKey * 0.3;

      // Always emit registered nodes for stable UI (empty timings = idle)
      entries.push({ nodeId, nodeType: type, timings, isHot });
    }

    // Sort by smoothed sort key for stable ordering
    entries.sort((a, b) => {
      const aKey = this.nodes.get(a.nodeId)?.sortKey ?? 0;
      const bKey = this.nodes.get(b.nodeId)?.sortKey ?? 0;
      return bKey - aKey;
    });

    const snapshot: ProfilerSnapshot = {
      timestamp: now,
      entries,
      ...(this.latestRenderFrame && {
        renderFrame: this.latestRenderFrame
      })
    };

    // Push to history ring buffer
    this.history[this.historyHead] = snapshot;
    this.historyHead = (this.historyHead + 1) % HISTORY_CAPACITY;
    if (this.historyCount < HISTORY_CAPACITY) this.historyCount++;

    this.onSnapshot?.(snapshot);
  }
}
