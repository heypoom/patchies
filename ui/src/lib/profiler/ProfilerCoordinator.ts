import { ProfilerCollector } from './ProfilerCollector';
import { HOT_THRESHOLD_MS } from './types';
import type { NodeProfileEntry, ProfilerSnapshot, TimingStats } from './types';

const HISTORY_CAPACITY = 120; // 120 × 500ms = 60 seconds
const FLUSH_INTERVAL_MS = 500;

interface NodeCollectors {
  message: ProfilerCollector;
  init: ProfilerCollector;
  type: string;
}

/**
 * Coordinates per-node timing data on the main thread.
 * Aggregates samples every 500ms and maintains a 60-second history ring buffer.
 */
export class ProfilerCoordinator {
  private static instance: ProfilerCoordinator | null = null;

  private collectors = new Map<string, NodeCollectors>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onSnapshot: ((snapshot: ProfilerSnapshot) => void) | null = null;

  // 60-second history ring buffer (plain objects, not reactive)
  private history: (ProfilerSnapshot | null)[] = new Array(HISTORY_CAPACITY).fill(null);
  private historyHead = 0;
  private historyCount = 0;

  // Enable-change listeners (used to broadcast to workers)
  private enableListeners: ((enabled: boolean) => void)[] = [];

  static getInstance(): ProfilerCoordinator {
    if (!ProfilerCoordinator.instance) {
      ProfilerCoordinator.instance = new ProfilerCoordinator();
    }
    return ProfilerCoordinator.instance;
  }

  /**
   * Record a message-processing timing sample for a node.
   * Called from ObjectService / MessageContext — only when profiler.enabled is true.
   */
  record(nodeId: string, type: string, durationMs: number): void {
    this.getOrCreate(nodeId, type).message.record(durationMs);
  }

  /**
   * Record an init (code execution) timing sample for a node.
   * Called from JSRunner after executeJavaScript — only when profiler.enabled is true.
   */
  recordInit(nodeId: string, type: string, durationMs: number): void {
    this.getOrCreate(nodeId, type).init.record(durationMs);
  }

  /**
   * Merge worker-side stats into the coordinator.
   * Called when a worker sends profilerStats or executionComplete with initDurationMs.
   */
  recordWorkerStats(
    nodeId: string,
    type: string,
    messageStats: TimingStats | null,
    initDurationMs: number | null
  ): void {
    const entry = this.getOrCreate(nodeId, type);
    if (messageStats !== null) {
      // Inject the aggregated stats directly by recording the avg as a single sample
      // (worker has already done its own ring-buffer aggregation)
      if (messageStats.avg > 0) {
        entry.message.record(messageStats.avg);
      }
    }
    if (initDurationMs !== null && initDurationMs > 0) {
      entry.init.record(initDurationMs);
    }
  }

  /** Remove a node's collectors when the node is deleted. */
  unregister(nodeId: string): void {
    this.collectors.delete(nodeId);
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

  private getOrCreate(nodeId: string, type: string): NodeCollectors {
    let entry = this.collectors.get(nodeId);
    if (!entry) {
      entry = { message: new ProfilerCollector(), init: new ProfilerCollector(), type };
      this.collectors.set(nodeId, entry);
    }
    return entry;
  }

  private flush(): void {
    const now = performance.now();
    const entries: NodeProfileEntry[] = [];

    for (const [nodeId, { message, init, type }] of this.collectors) {
      const msgStats = message.flush(now);
      const initStats = init.flush(now);

      const hasActivity = msgStats.callsPerSecond > 0 || msgStats.avg > 0 || initStats.avg > 0;
      if (!hasActivity) continue;

      const hasInitData = initStats.avg > 0 || initStats.max > 0;

      entries.push({
        nodeId,
        nodeType: type,
        processingTime: msgStats,
        ...(hasInitData && { initTime: initStats }),
        isHot: msgStats.avg > HOT_THRESHOLD_MS
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
