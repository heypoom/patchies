import type { Node } from '@xyflow/svelte';

const DEFAULT_NODE_WIDTH = 300;
const DEFAULT_NODE_HEIGHT = 200;

export interface VisualGroupSyncOptions {
  activeNodeIds?: string[];
  activeGroupIds?: string[];
}

export interface VisualGroupSyncResult {
  nodes: Node[];
  changed: boolean;
  changedNodeIds: string[];
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getNodeWidth(node: Node): number {
  return node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
}

function getNodeHeight(node: Node): number {
  return node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;
}

function isGroupNode(node: Node): boolean {
  return node.type === 'group';
}

function getAbsolutePosition(node: Node, nodeById: Map<string, Node>): { x: number; y: number } {
  if (!node.parentId) return node.position;

  const parent = nodeById.get(node.parentId);
  if (!parent) return node.position;

  const parentPosition = getAbsolutePosition(parent, nodeById);
  return {
    x: parentPosition.x + node.position.x,
    y: parentPosition.y + node.position.y
  };
}

function getAbsoluteRect(node: Node, nodeById: Map<string, Node>): Rect {
  const position = getAbsolutePosition(node, nodeById);
  return {
    x: position.x,
    y: position.y,
    width: getNodeWidth(node),
    height: getNodeHeight(node)
  };
}

function getCenter(rect: Rect): { x: number; y: number } {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

function containsPoint(rect: Rect, point: { x: number; y: number }): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function samePosition(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return a.x === b.x && a.y === b.y;
}

function orderParentsBeforeChildren(nodes: Node[]): Node[] {
  const childrenByParent = new Map<string, Node[]>();
  const nodeIds = new Set(nodes.map((node) => node.id));

  for (const node of nodes) {
    if (!node.parentId || !nodeIds.has(node.parentId)) continue;

    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }

  const emitted = new Set<string>();
  const ordered: Node[] = [];

  for (const node of nodes) {
    if (emitted.has(node.id)) continue;
    if (node.parentId && nodeIds.has(node.parentId)) continue;

    ordered.push(node);
    emitted.add(node.id);

    for (const child of childrenByParent.get(node.id) ?? []) {
      ordered.push(child);
      emitted.add(child.id);
    }
  }

  for (const node of nodes) {
    if (!emitted.has(node.id)) ordered.push(node);
  }

  return ordered;
}

function pickContainingGroup(
  node: Node,
  groupRects: Map<string, Rect>,
  center: { x: number; y: number },
  eligibleGroupIds: Set<string>
): string | undefined {
  if (node.parentId && eligibleGroupIds.has(node.parentId)) {
    const currentRect = groupRects.get(node.parentId);
    if (currentRect && containsPoint(currentRect, center)) return node.parentId;
  }

  return [...eligibleGroupIds]
    .map((id) => ({ id, rect: groupRects.get(id) }))
    .filter((entry): entry is { id: string; rect: Rect } => !!entry.rect)
    .filter((entry) => containsPoint(entry.rect, center))
    .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height)[0]?.id;
}

export function syncVisualGroupMembership(
  nodes: Node[],
  options: VisualGroupSyncOptions
): VisualGroupSyncResult {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const groups = nodes.filter(isGroupNode);
  const groupIds = new Set(groups.map((node) => node.id));
  const activeNodeIds = new Set(options.activeNodeIds ?? []);
  const activeGroupIds = new Set((options.activeGroupIds ?? []).filter((id) => groupIds.has(id)));
  const groupRects = new Map(groups.map((node) => [node.id, getAbsoluteRect(node, nodeById)]));
  const changedNodeIds: string[] = [];

  const candidateNodeIds = new Set<string>();

  for (const id of activeNodeIds) {
    const node = nodeById.get(id);
    if (node && !isGroupNode(node)) candidateNodeIds.add(id);
  }

  for (const groupId of activeGroupIds) {
    for (const node of nodes) {
      if (isGroupNode(node)) continue;
      if (!node.parentId || node.parentId === groupId) candidateNodeIds.add(node.id);
    }
  }

  const nextNodes = nodes.map((node) => {
    if (!candidateNodeIds.has(node.id)) return node;

    const absoluteRect = getAbsoluteRect(node, nodeById);
    const center = getCenter(absoluteRect);
    const eligibleGroupIds = activeGroupIds.size > 0 ? activeGroupIds : groupIds;
    const nextParentId = pickContainingGroup(node, groupRects, center, eligibleGroupIds);

    if (nextParentId) {
      const parentRect = groupRects.get(nextParentId);
      if (!parentRect) return node;

      const nextPosition = {
        x: absoluteRect.x - parentRect.x,
        y: absoluteRect.y - parentRect.y
      };

      if (node.parentId === nextParentId && samePosition(node.position, nextPosition)) {
        return node;
      }

      changedNodeIds.push(node.id);
      return {
        ...node,
        parentId: nextParentId,
        position: nextPosition
      };
    }

    if (!node.parentId && samePosition(node.position, absoluteRect)) {
      return node;
    }

    const { parentId, extent, ...rest } = node;
    void parentId;
    void extent;
    changedNodeIds.push(node.id);

    return {
      ...rest,
      position: {
        x: absoluteRect.x,
        y: absoluteRect.y
      }
    };
  });

  return {
    nodes: changedNodeIds.length > 0 ? orderParentsBeforeChildren(nextNodes) : nodes,
    changed: changedNodeIds.length > 0,
    changedNodeIds
  };
}
