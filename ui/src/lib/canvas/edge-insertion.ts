import type { Edge, Node } from '@xyflow/svelte';
import type { ObjectSchemaRegistry } from '$lib/objects/schemas';
import type { InletSchema } from '$lib/objects/schemas/types';
import { deriveHandleId } from '$lib/utils/handle-id';
import {
  isAcceptsFloatInlet,
  isAudioParamInlet,
  isValidConnectionBetweenHandles
} from '$lib/utils/connection-validation';

type NodeName = (node: Node) => string | undefined;

interface InletCandidate {
  handle: string;
  isAudioParam?: boolean;
}

function getStaticInletCandidates(schemaInlets: InletSchema[]): InletCandidate[] {
  return schemaInlets.flatMap((port) => {
    if (!port.handle) return [];

    return [
      {
        handle: deriveHandleId({
          port: 'inlet',
          type: port.handle.handleType,
          id: port.handle.handleId
        }),
        isAudioParam: port.isAudioParam
      }
    ];
  });
}

function getDynamicVideoHandles(
  node: Node,
  template: string | undefined,
  countKey: 'videoInletCount' | 'videoOutletCount'
): string[] {
  const count = (node.data as Record<string, unknown> | undefined)?.[countKey];
  if (!template || typeof count !== 'number' || count <= 0) return [];

  return Array.from({ length: Math.floor(count) }, (_, index) =>
    template.replace('{index}', index.toString())
  );
}

function getInletCandidates(
  node: Node,
  schemaInlets: InletSchema[],
  dynamicVideoInletTemplate?: string
): InletCandidate[] {
  const staticInlets = getStaticInletCandidates(schemaInlets);
  const uniformDefs = (node.data as { glUniformDefs?: unknown } | undefined)?.glUniformDefs;
  const patternInlets = getDynamicVideoHandles(
    node,
    dynamicVideoInletTemplate,
    'videoInletCount'
  ).map((handle) => ({ handle }));
  if (!Array.isArray(uniformDefs)) return [...staticInlets, ...patternInlets];

  const dynamicInlets = uniformDefs.flatMap((uniform, index) => {
    if (
      !uniform ||
      typeof uniform !== 'object' ||
      (uniform as { hideInlet?: unknown }).hideInlet === true ||
      typeof (uniform as { name?: unknown }).name !== 'string' ||
      typeof (uniform as { type?: unknown }).type !== 'string'
    ) {
      return [];
    }

    const { name, type } = uniform as { name: string; type: string };
    return [
      {
        handle: deriveHandleId({
          port: 'inlet',
          type: type === 'sampler2D' ? 'video' : 'message',
          id: `${index}-${name}-${type}`
        })
      }
    ];
  });

  return [...staticInlets, ...patternInlets, ...dynamicInlets];
}

export interface EdgeInsertionPlan {
  sourceHandle: string;
  insertedInletHandle: string;
  insertedOutletHandle: string;
  targetHandle: string;
}

/**
 * Creates the temporary pair of edges shown while a Quick Insert object is
 * still being named. They are intentionally marked as preview-only so the
 * patch runtime never treats the generic handles as a real connection.
 */
export function createEdgeInsertionPreview(
  edge: Edge,
  insertedNodeId: string,
  edgeIds: [string, string]
): Edge[] {
  return [
    {
      id: edgeIds[0],
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: insertedNodeId,
      targetHandle: 'message-in',
      zIndex: 0,
      data: { edgeInsertionPreview: true }
    },
    {
      id: edgeIds[1],
      source: insertedNodeId,
      sourceHandle: 'message-out',
      target: edge.target,
      targetHandle: edge.targetHandle,
      zIndex: 0,
      data: { edgeInsertionPreview: true }
    }
  ];
}

/**
 * Finds the first inlet and outlet on an inserted node that can replace an edge.
 * The edge is only rewired when both sides are compatible, preserving the original
 * connection rather than leaving a partial route behind.
 */
export function planEdgeInsertion(
  edge: Edge,
  insertedNode: Node,
  targetNode: Node | undefined,
  schemas: ObjectSchemaRegistry,
  getNodeName: NodeName
): EdgeInsertionPlan | null {
  if (!edge.sourceHandle || !edge.targetHandle || !targetNode) return null;

  const insertedName = getNodeName(insertedNode);
  const targetName = getNodeName(targetNode);
  const schema = insertedName ? schemas[insertedName] : undefined;
  if (!schema) return null;

  const inlet = getInletCandidates(
    insertedNode,
    schema.inlets,
    schema.handlePatterns?.inlet?.handleType === 'video'
      ? schema.handlePatterns.inlet.template
      : undefined
  ).find((candidate) => {
    return isValidConnectionBetweenHandles(edge.sourceHandle, candidate.handle, {
      isTargetAudioParam:
        candidate.isAudioParam ?? isAudioParamInlet(insertedName, candidate.handle),
      isTargetAcceptsFloat: isAcceptsFloatInlet(insertedName, candidate.handle)
    });
  });

  const outlet = [
    ...schema.outlets.flatMap((port) => {
      if (!port.handle) return [];

      return [
        deriveHandleId({
          port: 'outlet',
          type: port.handle.handleType,
          id: port.handle.handleId
        })
      ];
    }),
    ...getDynamicVideoHandles(
      insertedNode,
      schema.handlePatterns?.outlet?.handleType === 'video'
        ? schema.handlePatterns.outlet.template
        : undefined,
      'videoOutletCount'
    )
  ].find((handle) => {
    return isValidConnectionBetweenHandles(handle, edge.targetHandle, {
      isTargetAudioParam: isAudioParamInlet(targetName, edge.targetHandle),
      isTargetAcceptsFloat: isAcceptsFloatInlet(targetName, edge.targetHandle)
    });
  });

  if (!inlet || !outlet) return null;

  return {
    sourceHandle: edge.sourceHandle,
    insertedInletHandle: inlet.handle,
    insertedOutletHandle: outlet,
    targetHandle: edge.targetHandle
  };
}

/** Returns the visual midpoint between the edge's source and target nodes. */
export function getEdgeInsertionPosition(
  edge: Edge,
  nodes: Node[]
): { x: number; y: number } | null {
  const source = nodes.find((node) => node.id === edge.source);
  const target = nodes.find((node) => node.id === edge.target);
  if (!source || !target) return null;

  const center = (node: Node) => ({
    x: node.position.x + (node.measured?.width ?? node.width ?? 0) / 2,
    y: node.position.y + (node.measured?.height ?? node.height ?? 0) / 2
  });
  const sourceCenter = center(source);
  const targetCenter = center(target);

  return {
    x: (sourceCenter.x + targetCenter.x) / 2,
    y: (sourceCenter.y + targetCenter.y) / 2
  };
}

/** Returns a top-left position that places the inserted node's center on the edge midpoint. */
export function getCenteredNodeInsertionPosition(
  edge: Edge,
  nodes: Node[],
  insertedNode: Node
): { x: number; y: number } | null {
  const midpoint = getEdgeInsertionPosition(edge, nodes);
  const width = insertedNode.measured?.width ?? insertedNode.width;
  const height = insertedNode.measured?.height ?? insertedNode.height;
  if (!midpoint || width === undefined || height === undefined) return midpoint;

  return { x: midpoint.x - width / 2, y: midpoint.y - height / 2 };
}
