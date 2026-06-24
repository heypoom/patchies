import type { RenderNode } from '$lib/rendering/types';

interface ViewportCookSkipInput {
  node: Pick<RenderNode, 'id'>;
  requiredNodeIds: Set<string> | null;
}

interface ViewportCookRequiredInput {
  nodes: RenderNode[];
  visibleNodeIds: Set<string> | null;
  connectedVideoOutputNodeIds: Set<string>;
  effectiveOutputNodeId: string | null;
}

export function getViewportCookRequiredNodeIds({
  nodes,
  visibleNodeIds,
  connectedVideoOutputNodeIds,
  effectiveOutputNodeId
}: ViewportCookRequiredInput): Set<string> | null {
  if (visibleNodeIds === null) return null;

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const requiredNodeIds = new Set<string>();

  const addWithInputs = (nodeId: string) => {
    if (requiredNodeIds.has(nodeId)) return;

    const node = nodeById.get(nodeId);
    if (!node) return;

    requiredNodeIds.add(nodeId);

    for (const inputId of node.inputs) {
      addWithInputs(inputId);
    }
  };

  for (const nodeId of visibleNodeIds) {
    addWithInputs(nodeId);
  }

  if (effectiveOutputNodeId) {
    addWithInputs(effectiveOutputNodeId);
  }

  for (const nodeId of connectedVideoOutputNodeIds) {
    addWithInputs(nodeId);
  }

  return requiredNodeIds;
}

export function shouldSkipCookForViewport({
  node,
  requiredNodeIds
}: ViewportCookSkipInput): boolean {
  if (requiredNodeIds === null) return false;
  if (requiredNodeIds.has(node.id)) return false;

  return true;
}
