import type { Edge } from '@xyflow/svelte';

/**
 * Check if a node has message inlet/outlet connections.
 * Use with $derived in components for reactivity:
 *
 * ```ts
 * const edges = useEdges();
 * const connections = $derived(checkMessageConnections(edges.current, node.id));
 * ```
 */
export const checkMessageConnections = (edges: Edge[], nodeId: string) => ({
  hasInlet: edges.some((e) => e.target === nodeId && e.targetHandle === 'message-in'),
  hasOutlet: edges.some((e) => e.source === nodeId && e.sourceHandle === 'message-out')
});
