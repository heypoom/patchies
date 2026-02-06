import type { Edge, Node } from '@xyflow/svelte';

/**
 * Find edges that reference non-existent nodes or handles.
 * This handles cases where node handles change (e.g., GLSL uniforms modified)
 * but old edges weren't properly removed.
 *
 * @param edges - Current edges in the flow
 * @param nodes - Current nodes in the flow
 * @returns Array of invalid edge IDs that should be removed
 */
export function findInvalidEdges(edges: Edge[], nodes: Node[]): string[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const invalidEdgeIds: string[] = [];

  for (const edge of edges) {
    // Check if source/target nodes exist
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      invalidEdgeIds.push(edge.id);
      continue;
    }

    // Check if handles exist in DOM (after nodes have rendered)
    if (edge.sourceHandle) {
      const sourceHandle = document.querySelector(
        `[data-nodeid="${edge.source}"][data-handleid="${edge.sourceHandle}"]`
      );
      if (!sourceHandle) {
        invalidEdgeIds.push(edge.id);
        continue;
      }
    }

    if (edge.targetHandle) {
      const targetHandle = document.querySelector(
        `[data-nodeid="${edge.target}"][data-handleid="${edge.targetHandle}"]`
      );
      if (!targetHandle) {
        invalidEdgeIds.push(edge.id);
        continue;
      }
    }
  }

  return invalidEdgeIds;
}

/**
 * Remove invalid edges from the edges array.
 *
 * @param edges - Current edges in the flow
 * @param nodes - Current nodes in the flow
 * @returns New edges array with invalid edges removed, and count of removed edges
 */
export function cleanupInvalidEdges(
  edges: Edge[],
  nodes: Node[]
): { edges: Edge[]; removedCount: number } {
  const invalidEdgeIds = findInvalidEdges(edges, nodes);

  if (invalidEdgeIds.length > 0) {
    console.warn(`Cleaning up ${invalidEdgeIds.length} invalid edge(s):`, invalidEdgeIds);
    const invalidSet = new Set(invalidEdgeIds);
    return {
      edges: edges.filter((e) => !invalidSet.has(e.id)),
      removedCount: invalidEdgeIds.length
    };
  }

  return { edges, removedCount: 0 };
}
