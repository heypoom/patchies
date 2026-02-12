import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';

export interface ObjectData {
  expr: string;
  name: string;
  params: unknown[];
}

/**
 * Hook for tracking ObjectNode data changes (expr, name, params) with undo/redo support.
 *
 * Usage:
 * ```svelte
 * const tracker = useObjectDataTracker(nodeId, () => ({
 *   expr: data.expr,
 *   name: data.name,
 *   params: data.params
 * }));
 *
 * // On enter edit mode:
 * tracker.capture();
 *
 * // On exit edit mode (save):
 * tracker.commitIfChanged();
 * ```
 */
export function useObjectDataTracker(nodeId: string, getCurrentData: () => ObjectData) {
  const eventBus = PatchiesEventBus.getInstance();
  let snapshot: ObjectData | null = null;

  /**
   * Capture the current data state (call when entering edit mode).
   */
  function capture(): void {
    const data = getCurrentData();
    snapshot = {
      expr: data.expr,
      name: data.name,
      params: [...data.params]
    };
  }

  /**
   * Commit changes if data has changed since capture (call when exiting edit mode).
   * Returns true if a change was committed.
   */
  function commitIfChanged(): boolean {
    if (!snapshot) return false;

    const newData = getCurrentData();

    const hasChanged =
      snapshot.expr !== newData.expr ||
      snapshot.name !== newData.name ||
      JSON.stringify(snapshot.params) !== JSON.stringify(newData.params);

    if (hasChanged) {
      eventBus.dispatch({
        type: 'objectDataCommit',
        nodeId,
        oldData: snapshot,
        newData: {
          expr: newData.expr,
          name: newData.name,
          params: [...newData.params]
        }
      });
    }

    snapshot = null;
    return hasChanged;
  }

  /**
   * Clear the snapshot without committing (call on cancel/escape).
   */
  function clear(): void {
    snapshot = null;
  }

  return {
    capture,
    commitIfChanged,
    clear
  };
}
