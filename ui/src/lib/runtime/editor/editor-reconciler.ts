import type { Node } from '@xyflow/svelte';

import type { EditorRuntime } from '../types/editor-runtime';
import type { RuntimeObjectSpec } from '../types/runtime-object';

interface EditorRuntimeObject {
  expr?: unknown;
  name?: unknown;
  params?: unknown;

  [key: string]: unknown;
}

export const reconcileEditorRuntime = async (
  runtime: EditorRuntime,
  nodes: Node[]
): Promise<void> => runtime.reconcileObjects(nodes.flatMap(getRuntimeObjectSpecFromEditorNode));

function getRuntimeObjectSpecFromEditorNode(node: Node): RuntimeObjectSpec[] {
  const objectType = getRuntimeObjectType(node);
  if (!objectType) return [];

  const data = node.data as EditorRuntimeObject | undefined;

  return [{ id: node.id, type: objectType, data: getRuntimeObjectData(objectType, data) }];
}

function getRuntimeObjectType(node: Node): string {
  if (node.type === 'object') {
    const data = node.data as EditorRuntimeObject | undefined;

    return typeof data?.name === 'string' ? data.name : '';
  }

  return node.type ?? '';
}

function getRuntimeObjectData(
  objectType: string,
  data: EditorRuntimeObject | undefined
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
