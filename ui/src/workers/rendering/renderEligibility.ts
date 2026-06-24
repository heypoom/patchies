import type { RenderNode } from '$lib/rendering/types';

type ViewportCookSkipInput = {
  node: Pick<RenderNode, 'id' | 'outputs'>;
  visibleNodeIds: Set<string> | null;
  connectedVideoOutputNodeIds: Set<string>;
  effectiveOutputNodeId: string | null;
};

export function shouldSkipCookForViewport({
  node,
  visibleNodeIds,
  connectedVideoOutputNodeIds,
  effectiveOutputNodeId
}: ViewportCookSkipInput): boolean {
  if (visibleNodeIds === null) return false;
  if (visibleNodeIds.has(node.id)) return false;

  if (node.id === effectiveOutputNodeId) return false;
  if (node.outputs.length > 0) return false;

  if (connectedVideoOutputNodeIds.has(node.id)) return false;

  return true;
}
