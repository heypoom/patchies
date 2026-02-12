import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';

/**
 * Hook for tracking node data changes with undo/redo support.
 *
 * Two modes:
 * 1. Discrete changes (immediate) - for toggles, color pickers, dropdowns
 * 2. Continuous changes (on blur) - for text inputs, sliders
 *
 * Usage:
 * ```svelte
 * const tracker = useNodeDataTracker(node.id);
 *
 * // Discrete: records immediately
 * tracker.commit('color', oldColor, newColor);
 *
 * // Continuous: records on blur
 * const textField = tracker.track('text', node.data.text);
 * <input onfocus={textField.onFocus} onblur={textField.onBlur} />
 * ```
 */
export function useNodeDataTracker(nodeId: string) {
  const eventBus = PatchiesEventBus.getInstance();

  /**
   * Immediately record a discrete change (toggles, color pickers, etc.)
   */
  function commit(dataKey: string, oldValue: unknown, newValue: unknown): void {
    if (oldValue === newValue) return;

    eventBus.dispatch({
      type: 'nodeDataCommit',
      nodeId,
      dataKey,
      oldValue,
      newValue
    });
  }

  /**
   * Create a tracker for continuous input (text fields, sliders).
   * Call onFocus when input gains focus, onBlur when it loses focus.
   * The change is recorded on blur if the value changed.
   */
  function track<T>(dataKey: string, getCurrentValue: () => T) {
    let valueOnFocus: T | null = null;

    return {
      onFocus: () => {
        valueOnFocus = getCurrentValue();
      },
      onBlur: () => {
        const currentValue = getCurrentValue();
        if (valueOnFocus !== null && valueOnFocus !== currentValue) {
          commit(dataKey, valueOnFocus, currentValue);
        }
        valueOnFocus = null;
      }
    };
  }

  /**
   * Wrap a setter function to automatically track discrete changes.
   * Useful for simple value updates where you have the old value.
   */
  function tracked<T>(dataKey: string, oldValue: T, setter: (value: T) => void) {
    return (newValue: T) => {
      setter(newValue);
      commit(dataKey, oldValue, newValue);
    };
  }

  return {
    commit,
    track,
    tracked
  };
}
