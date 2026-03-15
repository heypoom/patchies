/**
 * Handlers for the connect_edges and disconnect_edges chat tools.
 *
 * Extracted from resolver.ts to keep the streaming logic readable.
 */

import { getModeDescriptor } from '../modes/descriptors';
import { validateEdgeHandles } from '../validate-edge-handles';
import type { AiPromptMode, AiModeResult } from '../modes/types';
import type { ChatAction, ChatNode, ChatGraphSummary } from './resolver';

interface EdgeToolDeps {
  getNodeById?: (nodeId: string) => ChatNode | undefined;
  getGraphSummary?: () => ChatGraphSummary;
}

/**
 * Resolve a connect_edges tool call into a ChatAction.
 */
export function resolveConnectEdges(args: Record<string, unknown>, deps: EdgeToolDeps): ChatAction {
  const edgeSpecs = args.edges as Array<{
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;

  if (!Array.isArray(edgeSpecs) || edgeSpecs.length === 0) {
    throw new Error('connect_edges requires a non-empty edges array');
  }

  // Validate that referenced nodes exist
  for (const spec of edgeSpecs) {
    if (!deps.getNodeById?.(spec.source)) {
      throw new Error(`Source node "${spec.source}" not found`);
    }

    if (!deps.getNodeById?.(spec.target)) {
      throw new Error(`Target node "${spec.target}" not found`);
    }
  }

  const allEdges = edgeSpecs.map((spec, i) => ({
    id: `ai-edge-${crypto.randomUUID().slice(0, 8)}-${i}`,
    source: spec.source,
    target: spec.target,
    sourceHandle: spec.sourceHandle ?? null,
    targetHandle: spec.targetHandle ?? null
  }));

  // Validate handle IDs against known specs
  const { valid: edges, invalid: invalidEdges } = validateEdgeHandles(
    allEdges,
    (id) => deps.getNodeById?.(id)?.type ?? undefined
  );

  if (invalidEdges.length > 0) {
    console.warn(
      `[AI connect_edges] Filtered ${invalidEdges.length} invalid edge(s):`,
      invalidEdges.map((e) => e.reason)
    );
  }

  return {
    id: crypto.randomUUID(),
    mode: 'connect-edges' as AiPromptMode,
    descriptor: getModeDescriptor('connect-edges'),
    result: {
      kind: 'connect-edges',
      edges,
      invalidEdges: invalidEdges.length > 0 ? invalidEdges : undefined
    } as AiModeResult,
    state: 'pending'
  };
}

/**
 * Resolve a disconnect_edges tool call into a ChatAction.
 */
export function resolveDisconnectEdges(
  args: Record<string, unknown>,
  deps: EdgeToolDeps
): ChatAction {
  const edgeSpecs = args.edges as Array<{
    edgeId?: string;
    source?: string;
    target?: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;

  if (!Array.isArray(edgeSpecs) || edgeSpecs.length === 0) {
    throw new Error('disconnect_edges requires a non-empty edges array');
  }

  const graph = deps.getGraphSummary?.() ?? { nodes: [], edges: [] };
  const matchedEdgeIds = new Set<string>();

  for (const spec of edgeSpecs) {
    if (spec.edgeId) {
      // Direct ID match
      if (graph.edges.some((e) => e.id === spec.edgeId)) {
        matchedEdgeIds.add(spec.edgeId);
      } else {
        console.warn(`[AI disconnect_edges] Edge "${spec.edgeId}" not found`);
      }
    } else if (spec.source && spec.target) {
      // Match by source/target pair (optionally narrowed by handles)
      for (const e of graph.edges) {
        if (e.source !== spec.source || e.target !== spec.target) continue;
        if (spec.sourceHandle && e.sourceHandle !== spec.sourceHandle) continue;
        if (spec.targetHandle && e.targetHandle !== spec.targetHandle) continue;

        matchedEdgeIds.add(e.id);
      }
    }
  }

  if (matchedEdgeIds.size === 0) {
    throw new Error('No matching edges found to disconnect');
  }

  return {
    id: crypto.randomUUID(),
    mode: 'disconnect-edges' as AiPromptMode,
    descriptor: getModeDescriptor('disconnect-edges'),
    result: {
      kind: 'disconnect-edges',
      edgeIds: [...matchedEdgeIds]
    } as AiModeResult,
    state: 'pending'
  };
}
