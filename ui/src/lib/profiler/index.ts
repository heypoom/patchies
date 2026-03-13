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

  unregister(nodeId: string): void {
    ProfilerCoordinator.getInstance().unregister(nodeId);
  }
};
