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

/**
 * Build a set of qualified handle IDs that are connected to audio sources.
 * Used for O(1) lookup in StandardHandle to determine inlet color.
 *
 * @returns Set of `${nodeId}/${handleId}` strings for inlets connected to audio outlets
 */
export const buildAudioSourceConnections = (edges: Edge[]): Set<string> => {
  const connected = new Set<string>();

  for (const edge of edges) {
    if (edge.sourceHandle?.includes('audio-out') && edge.target && edge.targetHandle) {
      connected.add(`${edge.target}/${edge.targetHandle}`);
    }
  }

  return connected;
};
