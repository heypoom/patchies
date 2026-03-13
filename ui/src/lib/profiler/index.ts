import { ProfilerCoordinator } from './ProfilerCoordinator';

export { ProfilerCoordinator } from './ProfilerCoordinator';
export type { TimingStats, NodeProfileEntry, ProfilerSnapshot } from './types';
export { HOT_THRESHOLD_MS } from './types';

/**
 * Lightweight profiler handle.
 *
 * `profiler.enabled` is a plain boolean — checked in hot paths with zero overhead when false.
 * Set via profiler.store.ts (not directly).
 */
export const profiler = {
  enabled: false,

  record(nodeId: string, type: string, durationMs: number): void {
    ProfilerCoordinator.getInstance().record(nodeId, type, durationMs);
  },

  recordInit(nodeId: string, type: string, durationMs: number): void {
    ProfilerCoordinator.getInstance().recordInit(nodeId, type, durationMs);
  },

  /**
   * Measure a synchronous callback and record its duration.
   * When `type` is null or `profiler.enabled` is false, the callback is called directly
   * with no timing overhead.
   */
  measure(nodeId: string, type: string | null, fn: () => void): void {
    if (!this.enabled || !type) {
      fn();
      return;
    }
    const t0 = performance.now();
    fn();
    ProfilerCoordinator.getInstance().record(nodeId, type, performance.now() - t0);
  },

  unregister(nodeId: string): void {
    ProfilerCoordinator.getInstance().unregister(nodeId);
  },

  onEnableChange(listener: (enabled: boolean) => void): void {
    ProfilerCoordinator.getInstance().onEnableChange(listener);
  }
};
