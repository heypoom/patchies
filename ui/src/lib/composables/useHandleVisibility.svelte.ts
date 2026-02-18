import { useStore } from '@xyflow/svelte';

export interface HandleVisibilityOptions {
  nodeId: string;
  inletHandle?: string;
  outletHandle?: string;
}

export const HIDDEN_HANDLE_CLASS = 'opacity-30 group-hover:opacity-100 sm:opacity-0';

/**
 * Composable for smart handle visibility based on connections.
 *
 * In auto mode, handles are always visible (no fade) when connected,
 * and fade on hover when not connected.
 *
 * @example
 * ```svelte
 * const { hasInletConnection, hasOutletConnection } = useHandleVisibility({ nodeId: node.id });
 *
 * const inletClass = $derived(
 *   node.selected || $shouldShowHandles || hasInletConnection ? '' : HIDDEN_HANDLE_CLASS
 * );
 * ```
 */
export function useHandleVisibility(options: HandleVisibilityOptions) {
  const { nodeId, inletHandle = 'message-in', outletHandle = 'message-out' } = options;
  const store = useStore();

  const hasInletConnection = $derived(
    store.edges.some((e) => e.target === nodeId && e.targetHandle === inletHandle)
  );

  const hasOutletConnection = $derived(
    store.edges.some((e) => e.source === nodeId && e.sourceHandle === outletHandle)
  );

  return {
    hasInletConnection,
    hasOutletConnection
  };
}
