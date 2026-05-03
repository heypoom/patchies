/**
 * Handlers for direct canvas mutation chat tools.
 *
 * These tools turn final structured args into ChatActions without running another
 * LLM-backed mode resolver.
 */

import { getModeDescriptor } from '../modes/descriptors';
import type { AiModeResult, AiPromptMode } from '../modes/types';
import type { AiObjectNode, SimplifiedEdge } from '../types';
import { assertKnownCanvasObjectType } from './object-type-validation';
import type { ChatAction, ChatNode } from './resolver';

interface DirectToolDeps {
  getNodeById?: (nodeId: string) => ChatNode | undefined;
}

const INTERNAL_FIELDS = new Set(['executeCode', 'initialized']);

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function assertJsonSerializable(value: unknown, label: string): void {
  try {
    JSON.stringify(value);
  } catch {
    throw new Error(`${label} must be JSON-serializable`);
  }
}

function assertPosition(value: unknown, label: string): { x: number; y: number } {
  const position = assertRecord(value, label);
  const x = position.x;
  const y = position.y;

  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    throw new Error(`${label}.x and ${label}.y must be finite numbers`);
  }

  return { x, y };
}

function sanitizeData(
  data: Record<string, unknown>,
  options: { preserveInternalName?: boolean } = {}
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => {
      if (key === 'name' && options.preserveInternalName) return false;

      return !INTERNAL_FIELDS.has(key) && !key.startsWith('__');
    })
  );
}

function pendingAction(
  mode: AiPromptMode,
  result: AiModeResult,
  descriptorMode: AiPromptMode = mode
): ChatAction {
  return {
    id: crypto.randomUUID(),
    mode,
    descriptor: getModeDescriptor(descriptorMode),
    result,
    state: 'pending'
  };
}

export function resolveInsertObject(args: Record<string, unknown>): ChatAction {
  const type = assertKnownCanvasObjectType(args.type);
  const data = sanitizeData(assertRecord(args.data, 'data'));
  const position = args.position ? assertPosition(args.position, 'position') : undefined;

  assertJsonSerializable(data, 'data');

  return pendingAction('insert', {
    kind: 'single',
    type,
    data,
    ...(position ? { position } : {})
  });
}

export function resolveInsertObjects(args: Record<string, unknown>): ChatAction {
  const rawNodes = args.nodes;

  if (!Array.isArray(rawNodes) || rawNodes.length === 0) {
    throw new Error('insert_objects requires a non-empty nodes array');
  }

  const nodes: AiObjectNode[] = rawNodes.map((rawNode, index) => {
    const node = assertRecord(rawNode, `nodes[${index}]`);
    const type = assertKnownCanvasObjectType(node.type);
    const data = sanitizeData(assertRecord(node.data, `nodes[${index}].data`));
    const position =
      node.position && typeof node.position === 'object' && !Array.isArray(node.position)
        ? (node.position as { x: number; y: number })
        : undefined;

    assertJsonSerializable(data, `nodes[${index}].data`);

    return { type, data, ...(position ? { position } : {}) };
  });

  const rawEdges = args.edges;
  const edges: SimplifiedEdge[] = Array.isArray(rawEdges)
    ? rawEdges.map((rawEdge, index) => {
        const edge = assertRecord(rawEdge, `edges[${index}]`);
        const source = edge.source;
        const target = edge.target;

        if (typeof source !== 'number' || typeof target !== 'number') {
          throw new Error(`edges[${index}] source and target must be node indexes`);
        }

        if (!nodes[source]) throw new Error(`edges[${index}] source index ${source} is invalid`);
        if (!nodes[target]) throw new Error(`edges[${index}] target index ${target} is invalid`);

        return {
          source,
          target,
          ...(typeof edge.sourceHandle === 'string' ? { sourceHandle: edge.sourceHandle } : {}),
          ...(typeof edge.targetHandle === 'string' ? { targetHandle: edge.targetHandle } : {})
        };
      })
    : [];

  return pendingAction('multi', {
    kind: 'multi',
    nodes,
    edges
  });
}

export function resolveUpdateObjectData(
  args: Record<string, unknown>,
  deps: DirectToolDeps
): ChatAction {
  const nodeId = typeof args.nodeId === 'string' ? args.nodeId : '';
  const node = deps.getNodeById?.(nodeId);

  if (!node) throw new Error(`Node "${nodeId}" not found`);

  const patch = sanitizeData(assertRecord(args.patch, 'patch'), { preserveInternalName: true });

  assertJsonSerializable(patch, 'patch');

  return pendingAction(
    'edit',
    {
      kind: 'edit',
      nodeId: node.id,
      data: patch
    },
    'edit'
  );
}

export function resolveReplaceObject(
  args: Record<string, unknown>,
  deps: DirectToolDeps
): ChatAction {
  const nodeId = typeof args.nodeId === 'string' ? args.nodeId : '';

  if (!deps.getNodeById?.(nodeId)) {
    throw new Error(`Node "${nodeId}" not found`);
  }

  const newType = assertKnownCanvasObjectType(args.type);
  const newData = sanitizeData(assertRecord(args.data, 'data'));

  assertJsonSerializable(newData, 'data');

  return pendingAction(
    'turn-into',
    {
      kind: 'replace',
      nodeId,
      newType,
      newData
    },
    'turn-into'
  );
}

export function resolveDeleteObjects(
  args: Record<string, unknown>,
  deps: DirectToolDeps
): ChatAction {
  const rawNodeIds = args.nodeIds;

  if (!Array.isArray(rawNodeIds) || rawNodeIds.length === 0) {
    throw new Error('delete_objects requires a non-empty nodeIds array');
  }

  const seen = new Set<string>();

  const nodeIds = rawNodeIds.map((rawNodeId, index) => {
    if (typeof rawNodeId !== 'string' || !rawNodeId.trim()) {
      throw new Error(`nodeIds[${index}] must be a non-empty string`);
    }

    if (!deps.getNodeById?.(rawNodeId)) {
      throw new Error(`Node "${rawNodeId}" not found`);
    }

    if (seen.has(rawNodeId)) {
      throw new Error(`Duplicate node ID "${rawNodeId}"`);
    }

    seen.add(rawNodeId);
    return rawNodeId;
  });

  return pendingAction('delete-objects', {
    kind: 'delete-objects',
    nodeIds
  });
}

export function resolveMoveObjects(
  args: Record<string, unknown>,
  deps: DirectToolDeps
): ChatAction {
  const rawPositions = args.positions;

  if (!Array.isArray(rawPositions) || rawPositions.length === 0) {
    throw new Error('move_objects requires a non-empty positions array');
  }

  const seen = new Set<string>();

  const positions = rawPositions.map((rawPosition, index) => {
    const entry = assertRecord(rawPosition, `positions[${index}]`);
    const nodeId = entry.nodeId;

    if (typeof nodeId !== 'string' || !nodeId.trim()) {
      throw new Error(`positions[${index}].nodeId must be a non-empty string`);
    }

    if (!deps.getNodeById?.(nodeId)) {
      throw new Error(`Node "${nodeId}" not found`);
    }

    if (seen.has(nodeId)) {
      throw new Error(`Duplicate node ID "${nodeId}"`);
    }

    seen.add(nodeId);

    return {
      nodeId,
      position: assertPosition(entry.position, `positions[${index}].position`)
    };
  });

  return pendingAction('move-objects', {
    kind: 'move-objects',
    positions
  });
}
