import type { Edge } from '@xyflow/svelte';

/**
 * Removes outlet edges whose video-out-N index is >= mrtCount.
 *
 * Call this whenever a video node's outlet count decreases
 * so dangling edges are cleaned up.
 */
export const removeExcessVideoOutletEdges = (
  nodeId: string,
  mrtCount: number,
  getEdges: () => Edge[],
  deleteElements: (params: { edges: Edge[] }) => void
) => removeExcessOutletEdges(nodeId, mrtCount, /video-out-(\d+)/, getEdges, deleteElements);

/**
 * Removes outlet edges whose message-out-N index is >= outletCount.
 *
 * Call this whenever a message node's outlet count decreases
 * so dangling edges are cleaned up.
 */
export const removeExcessMessageOutletEdges = (
  nodeId: string,
  outletCount: number,
  getEdges: () => Edge[],
  deleteElements: (params: { edges: Edge[] }) => void
) => removeExcessOutletEdges(nodeId, outletCount, /message-out-(\d+)/, getEdges, deleteElements);

/**
 * Removes outlet edges whose audio-out-N index is >= outletCount.
 *
 * Call this whenever an audio node's outlet count decreases
 * so dangling edges are cleaned up.
 */
export const removeExcessAudioOutletEdges = (
  nodeId: string,
  outletCount: number,
  getEdges: () => Edge[],
  deleteElements: (params: { edges: Edge[] }) => void
) => removeExcessOutletEdges(nodeId, outletCount, /audio-out-(\d+)/, getEdges, deleteElements);

function removeExcessOutletEdges(
  nodeId: string,
  maxCount: number,
  handlePattern: RegExp,
  getEdges: () => Edge[],
  deleteElements: (params: { edges: Edge[] }) => void
) {
  const excess = getEdges().filter((edge) => {
    if (edge.source !== nodeId) return false;

    const match = edge.sourceHandle?.match(handlePattern);

    return match ? parseInt(match[1], 10) >= maxCount : false;
  });

  if (excess.length > 0) {
    deleteElements({ edges: excess });
  }
}
