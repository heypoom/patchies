import type { Edge, Node } from '@xyflow/svelte';
import { prepareGlslForEdgeInsertion } from '$objects/glsl/edge-insertion';

type EdgeInsertionAdapter = (node: Node, edge: Edge) => Node;

const adapters: Record<string, EdgeInsertionAdapter | undefined> = {
  glsl: prepareGlslForEdgeInsertion,
  hydra: prepareVideoPipeForEdgeInsertion,
  three: prepareVideoPipeForEdgeInsertion,
  regl: prepareVideoPipeForEdgeInsertion
};

function prepareVideoPipeForEdgeInsertion(node: Node, edge: Edge): Node {
  if (!edge.sourceHandle?.startsWith('video-out')) return node;

  return {
    ...node,
    data: {
      ...node.data,
      videoInletCount: (node.data?.videoInletCount as number | undefined) ?? 1,
      videoOutletCount: (node.data?.videoOutletCount as number | undefined) ?? 1
    }
  };
}

/** Applies object-owned setup needed before a node can be connected into an edge. */
export function prepareNodeForEdgeInsertion(node: Node, edge: Edge): Node {
  return adapters[node.type ?? '']?.(node, edge) ?? node;
}
