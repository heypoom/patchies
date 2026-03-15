import type { Edge } from '@xyflow/svelte';
import { validateHandle } from './debug/handle-specs';

export interface EdgeValidationResult {
  valid: Edge[];
  invalid: { edge: Edge; reason: string }[];
}

/**
 * Validate AI-generated edges by checking source and target handle IDs
 * against the known handle specs for each node type.
 *
 * Returns valid edges and invalid edges with reasons, so callers can
 * filter bad edges and warn the user.
 */
export function validateEdgeHandles(
  edges: Edge[],
  getNodeType: (nodeId: string) => string | undefined
): EdgeValidationResult {
  const valid: Edge[] = [];
  const invalid: { edge: Edge; reason: string }[] = [];

  for (const edge of edges) {
    const sourceType = getNodeType(edge.source);
    const targetType = getNodeType(edge.target);

    if (!sourceType || !targetType) {
      // Can't validate if we don't know the node type — let it through
      valid.push(edge);
      continue;
    }

    const sourceError = edge.sourceHandle
      ? validateHandle(sourceType, edge.sourceHandle, 'out')
      : null;

    const targetError = edge.targetHandle
      ? validateHandle(targetType, edge.targetHandle, 'in')
      : null;

    if (sourceError || targetError) {
      const reasons: string[] = [];
      if (sourceError) reasons.push(`source handle "${edge.sourceHandle}": ${sourceError}`);
      if (targetError) reasons.push(`target handle "${edge.targetHandle}": ${targetError}`);
      invalid.push({ edge, reason: reasons.join('; ') });
    } else {
      valid.push(edge);
    }
  }

  return { valid, invalid };
}
