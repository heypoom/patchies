import type { Edge as XYEdge } from '@xyflow/svelte';

// Utilities for building and analyzing render graphs

import type { RenderNode, RenderEdge, RenderGraph } from './types.js';
import { isFBOCompatible } from './types.js';

export type RNode = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};

export type REdge = Pick<XYEdge, 'id' | 'source' | 'target' | 'sourceHandle' | 'targetHandle'>;

/**
 * Parse outlet index from a sourceHandle string like "video-out-0". Returns 0 if absent or unparseable.
 * Handles both numeric ("video-out-1") and legacy non-numeric ("video-out-out") handles.
 */
export function parseOutletIndex(sourceHandle: string | undefined): number {
  if (!sourceHandle?.startsWith('video-out')) return 0;

  const match = sourceHandle.match(/video-out-(\d+)/);

  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Filter nodes and edges to only include FBO-compatible nodes
 */
export function filterFBOCompatibleGraph(
  nodes: RNode[],
  edges: REdge[]
): { nodes: RenderNode[]; edges: RenderEdge[] } {
  // Filter to only GLSL nodes for now
  const compatibleNodes = nodes
    .filter((node) => isFBOCompatible(node.type))
    .map(
      (node): RenderNode => ({
        id: node.id,
        type: node.type as 'img',
        inputs: [],
        outputs: [],
        inletMap: new Map(),
        data: node.data,
        backEdgeInlets: new Set()
      })
    );

  const nodeIds = new Set(compatibleNodes.map((n) => n.id));

  // Filter edges to only connect compatible nodes
  const compatibleEdges = edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined
    }));

  // Build input/output relationships
  const nodeMap = new Map(compatibleNodes.map((n) => [n.id, n]));

  for (const edge of compatibleEdges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if (sourceNode && targetNode) {
      sourceNode.outputs.push(edge.target);
      targetNode.inputs.push(edge.source);

      // Parse inlet index from target handle for video connections
      if (edge.targetHandle?.startsWith('video-in')) {
        const inletMatch = edge.targetHandle.match(/video-in-(\d+)/);

        if (inletMatch) {
          const inletIndex = parseInt(inletMatch[1], 10);
          const outletIndex = parseOutletIndex(edge.sourceHandle);

          targetNode.inletMap.set(inletIndex, { sourceNodeId: edge.source, outletIndex });
        }
      }
    }
  }

  return { nodes: compatibleNodes, edges: compatibleEdges };
}

/**
 * Topological sort with feedback loop support.
 *
 * Cycles are handled by detecting back-edges during DFS. A back-edge is an
 * edge whose source is already on the current DFS stack — meaning it completes
 * a cycle. Back-edges are "broken" by routing them through the previous frame's
 * texture instead of the current frame's (1-frame delay).
 *
 * Returns the sorted node IDs, the set of back-edge IDs, and the set of node
 * IDs that need double-buffered FBOs (sources of back-edges).
 *
 * Also annotates each RenderNode's `backEdgeInlets` set in-place.
 */
export function topologicalSort(
  nodes: RenderNode[],
  edges: RenderEdge[]
): { sortedNodes: string[]; backEdgeIds: Set<string>; feedbackNodeIds: Set<string> } {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: string[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const backEdgeIds = new Set<string>();
  const feedbackNodeIds = new Set<string>();

  // Build edge lookup: `${source}:${target}` → edge IDs (multiple edges can share same source/target)
  const edgeLookup = new Map<string, string[]>();

  for (const edge of edges) {
    const key = `${edge.source}:${edge.target}`;
    const existing = edgeLookup.get(key);

    if (existing) {
      existing.push(edge.id);
    } else {
      edgeLookup.set(key, [edge.id]);
    }
  }

  function visit(nodeId: string): void {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) return; // cycle back-edge — handled by caller

    visiting.add(nodeId);

    const node = nodeMap.get(nodeId);

    if (node) {
      for (const inputId of node.inputs) {
        if (visiting.has(inputId)) {
          // Back-edge detected: inputId (source) → nodeId (target) completes a cycle
          feedbackNodeIds.add(inputId);

          // Mark which inlets of this node connect to the feedback source
          for (const [inletIndex, { sourceNodeId }] of node.inletMap) {
            if (sourceNodeId === inputId) {
              node.backEdgeInlets.add(inletIndex);
            }
          }

          // Record edge IDs for the back-edge
          const edgeIds = edgeLookup.get(`${inputId}:${nodeId}`);

          if (edgeIds) {
            for (const id of edgeIds) backEdgeIds.add(id);
          }
        } else {
          visit(inputId);
        }
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    result.push(nodeId);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      visit(node.id);
    }
  }

  return { sortedNodes: result, backEdgeIds, feedbackNodeIds };
}

/**
 * Build a complete render graph from XYFlow nodes and edges.
 * Cycles are supported — back-edges get 1-frame delay via double-buffered FBOs.
 */
export function buildRenderGraph(nodes: RNode[], edges: REdge[]): RenderGraph {
  const outputNodeId = findOutputNode(nodes, edges);

  const { nodes: renderNodes, edges: renderEdges } = filterFBOCompatibleGraph(nodes, edges);

  const { sortedNodes, backEdgeIds, feedbackNodeIds } = topologicalSort(renderNodes, renderEdges);

  return {
    nodes: renderNodes,
    edges: renderEdges,
    sortedNodes,
    outputNodeId,
    backEdges: backEdgeIds,
    feedbackNodes: feedbackNodeIds
  };
}

/**
 * Find nodes that need preview rendering (visible in UI)
 */
export function findPreviewNodes(renderGraph: RenderGraph): string[] {
  // For now, return all nodes - later we'll add visibility culling
  return renderGraph.nodes.map((n) => n.id);
}

/**
 * Find the output node (connected to bg.out)
 */
export function findOutputNode(nodes: RNode[], edges: REdge[]): string | null {
  // Find bg.out node
  const bgOutNode = nodes.find((node) => node.type === 'bg.out');
  if (!bgOutNode) return null;

  // Find edge connecting to bg.out
  const inputEdge = edges.find((edge) => edge.target === bgOutNode.id);
  if (!inputEdge) return null;

  return inputEdge.source;
}
