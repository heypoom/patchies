import type { Edge } from '@xyflow/svelte';

/**
 * Removes outlet edges whose video-out-N index is >= mrtCount.
 *
 * Call this whenever a video node's outlet count decreases
 * so dangling edges are cleaned up.
 */
export function removeExcessVideoOutletEdges(
  nodeId: string,
  mrtCount: number,
  getEdges: () => Edge[],
  deleteElements: (params: { edges: Edge[] }) => void
) {
  const excess = getEdges().filter((edge) => {
    if (edge.source !== nodeId) return false;

    const match = edge.sourceHandle?.match(/video-out-(\d+)/);

    return match ? parseInt(match[1], 10) >= mrtCount : false;
  });

  if (excess.length > 0) {
    deleteElements({ edges: excess });
  }
}
