import { ProfilerCoordinator } from './ProfilerCoordinator';
import type { ProfilerCategory } from './types';

export { ProfilerCoordinator } from './ProfilerCoordinator';
export type {
  TimingStats,
  NodeProfileEntry,
  ProfilerSnapshot,
  RenderFrameStats,
  ProfilerCategory
} from './types';
export { HOT_THRESHOLD_MS } from './types';

/**
 * Extract the node type from a nodeId of the form `${type}-${counter}`.
 * Uses lastIndexOf to handle types that contain hyphens (e.g. "post-it-3" → "post-it").
 */
export function typeFromNodeId(nodeId: string): string {
  const sep = nodeId.lastIndexOf('-');
  return sep > 0 ? nodeId.slice(0, sep) : nodeId;
}

/**
 * Lightweight profiler handle.
 *
 * `profiler.enabled` is a plain boolean — checked in hot paths with zero overhead when false.
 * Set via profiler.store.ts (not directly).
 */
export const profiler = {
  enabled: false,

  record(nodeId: string, type: string, category: ProfilerCategory, durationMs: number): void {
    ProfilerCoordinator.getInstance().record(nodeId, type, category, durationMs);
  },

  /**
   * Measure a synchronous callback and record its duration under the given category.
   * The node type is derived from the nodeId (format: `${type}-${counter}`).
   * When `profiler.enabled` is false, the callback is called directly with no overhead.
   */
  measure(nodeId: string, category: ProfilerCategory, fn: () => void): void {
    if (!this.enabled) {
      fn();
      return;
    }
    const t0 = performance.now();
    fn();
    ProfilerCoordinator.getInstance().record(
      nodeId,
      typeFromNodeId(nodeId),
      category,
      performance.now() - t0
    );
  },

  unregister(nodeId: string): void {
    ProfilerCoordinator.getInstance().unregister(nodeId);
  },

  onEnableChange(listener: (enabled: boolean) => void): void {
    ProfilerCoordinator.getInstance().onEnableChange(listener);
  }
};
