import type { Edge, Node } from '@xyflow/svelte';

import type { EditorRuntime } from '../types/editor-runtime';
import type { RuntimeConnectionSpec, RuntimeObjectSpec } from '../types/runtime-object';

/**
 * Node data of text objects in XYFlow node data representation.
 * See [[lib/objects/v2]].
 */
interface EditorTextObjectData {
  name?: unknown;
  expr?: unknown;
  params?: unknown;

  [key: string]: unknown;
}

/**
 * Using the XYFlow nodes and edges, update the patcher's headless runtime graph.
 */
export const setRuntimeGraphFromEditorGraph = async (
  runtime: EditorRuntime,
  nodes: Node[],
  edges: Edge[] = []
): Promise<void> =>
  runtime.setGraph({
    objects: nodes.flatMap(getRuntimeObjectSpecFromEditorNode),
    connections: edges.map(getRuntimeConnectionSpecFromEditorEdge)
  });

export const setRuntimeObjectsFromEditorNodes = async (
  runtime: EditorRuntime,
  nodes: Node[]
): Promise<void> => runtime.setObjects(nodes.flatMap(getRuntimeObjectSpecFromEditorNode));

export const setRuntimeConnectionsFromEditorEdges = (
  runtime: EditorRuntime,
  edges: Edge[]
): Promise<void> => runtime.setConnections(edges.map(getRuntimeConnectionSpecFromEditorEdge));

const getRuntimeConnectionSpecFromEditorEdge = (edge: Edge): RuntimeConnectionSpec => ({
  id: edge.id,
  source: edge.source,
  outlet: edge.sourceHandle ?? undefined,
  target: edge.target,
  inlet: edge.targetHandle ?? undefined
});

function getRuntimeObjectSpecFromEditorNode(node: Node): RuntimeObjectSpec[] {
  const objectType = getRuntimeObjectType(node);
  if (!objectType) return [];

  const data = node.data as EditorTextObjectData | undefined;

  return [{ id: node.id, type: objectType, data: getRuntimeObjectData(objectType, data) }];
}

function getRuntimeObjectType(node: Node): string {
  if (node.type === 'object') {
    const data = node.data as EditorTextObjectData | undefined;

    return typeof data?.name === 'string' ? data.name : '';
  }

  return node.type ?? '';
}

function getRuntimeObjectData(
  objectType: string,
  data: EditorTextObjectData | undefined
): Record<string, unknown> {
  if (data?.name === objectType) {
    return {
      expr: typeof data.expr === 'string' ? data.expr : '',
      name: objectType,
      params: Array.isArray(data.params) ? data.params : []
    };
  }

  return { ...data };
}
