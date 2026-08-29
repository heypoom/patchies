import type { RenderGraph, RenderNode } from '$lib/rendering/types';
import { topologicalSort } from '$lib/rendering/graphUtils';

export const isPassthroughNodeType = (nodeType: RenderNode['type']): boolean =>
  nodeType === 'send.vdo' || nodeType === 'recv.vdo';

/** Merges wireless video edges and recalculates graph ordering and feedback. */
export const mergeVideoGraphEdges = (
  renderGraph: RenderGraph,
  virtualEdges: RenderGraph['edges']
): RenderGraph => {
  const edgesById = new Map<string, RenderGraph['edges'][number]>();

  for (const edge of [...renderGraph.edges, ...virtualEdges]) {
    edgesById.set(edge.id, edge);
  }

  const mergedGraph: RenderGraph = {
    ...renderGraph,
    edges: [...edgesById.values()]
  };

  applyVirtualEdgesToNodes(mergedGraph);

  for (const node of mergedGraph.nodes) {
    node.backEdgeInlets.clear();
  }

  const { sortedNodes, backEdgeIds, feedbackNodeIds } = topologicalSort(
    mergedGraph.nodes,
    mergedGraph.edges
  );

  const feedbackStorageNodeIds = new Set<string>();

  for (const nodeId of feedbackNodeIds) {
    const sourceNodeId = resolveFeedbackStorageNodeId(nodeId, mergedGraph);

    if (sourceNodeId) {
      feedbackStorageNodeIds.add(sourceNodeId);
    }
  }

  return {
    ...mergedGraph,
    sortedNodes,
    backEdges: backEdgeIds,
    feedbackNodes: feedbackStorageNodeIds
  };
};

const applyVirtualEdgesToNodes = (graph: RenderGraph): void => {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));

  for (const edge of graph.edges) {
    if (!edge.id.startsWith('virtual-video-')) continue;

    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (!sourceNode || !targetNode) continue;

    if (!sourceNode.outputs.includes(edge.target)) {
      sourceNode.outputs.push(edge.target);
    }

    if (!targetNode.inputs.includes(edge.source)) {
      targetNode.inputs.push(edge.source);
    }

    const inletMatch = edge.targetHandle?.match(/^video-in-(\d+)$/);

    if (inletMatch) {
      targetNode.inletMap.set(Number(inletMatch[1]), {
        sourceNodeId: edge.source,
        outletIndex: 0
      });
    }
  }
};

const resolveFeedbackStorageNodeId = (
  nodeId: string,
  graph: RenderGraph,
  visited = new Set<string>()
): string | null => {
  if (visited.has(nodeId)) return null;
  visited.add(nodeId);

  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return null;
  if (!isPassthroughNodeType(node.type)) return nodeId;

  const inlet = node.inletMap.get(0);

  return inlet ? resolveFeedbackStorageNodeId(inlet.sourceNodeId, graph, visited) : null;
};
