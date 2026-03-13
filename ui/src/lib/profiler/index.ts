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

  /**
   * Accumulates broadcast callback time during a synchronous onMessage call.
   * ObjectService resets this before calling onMessage, then subtracts it from
   * the node's 'message' timing so send nodes don't double-count recv work.
   */
  _broadcastTime: 0,

  resetBroadcastTime(): void {
    this._broadcastTime = 0;
  },

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

  /**
   * Measure a broadcast callback: records under 'broadcast' for sourceNodeId,
   * and accumulates elapsed time so callers (e.g. ObjectService) can subtract
   * it from the sender's 'message' timing to avoid double-counting.
   */
  measureBroadcast(sourceNodeId: string, fn: () => void): void {
    if (!this.enabled) {
      fn();
      return;
    }
    const t0 = performance.now();
    fn();
    const elapsed = performance.now() - t0;
    ProfilerCoordinator.getInstance().record(
      sourceNodeId,
      typeFromNodeId(sourceNodeId),
      'broadcast',
      elapsed
    );
    this._broadcastTime += elapsed;
  },

  /**
   * Measure a node's message handler, automatically subtracting any broadcast
   * callback time that was accumulated during the call (via measureBroadcast).
   * This prevents send nodes from double-counting recv work.
   */
  measureMessage(nodeId: string, type: string, fn: () => void): void {
    if (!this.enabled) {
      fn();
      return;
    }
    this._broadcastTime = 0;
    const t0 = performance.now();
    fn();
    const elapsed = performance.now() - t0;
    ProfilerCoordinator.getInstance().record(
      nodeId,
      type,
      'message',
      Math.max(0, elapsed - this._broadcastTime)
    );
  },

  unregister(nodeId: string): void {
    ProfilerCoordinator.getInstance().unregister(nodeId);
  },

  onEnableChange(listener: (enabled: boolean) => void): () => void {
    return ProfilerCoordinator.getInstance().onEnableChange(listener);
  }
};
