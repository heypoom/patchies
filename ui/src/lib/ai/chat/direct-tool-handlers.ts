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

  assertJsonSerializable(data, 'data');

  return pendingAction('insert', {
    kind: 'single',
    type,
    data
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
