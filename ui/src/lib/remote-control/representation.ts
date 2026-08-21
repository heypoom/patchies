import type { Node } from '@xyflow/svelte';

export const PATCH_REPRESENTATION_VERSION = 'patchies.representation.v1';

export interface RepresentationAdapter {
  objectType: string;
  dataKey: string;
  fileName: string;
  runDataKey?: string;
}

export const representationAdapters: readonly RepresentationAdapter[] = [
  { objectType: 'glsl', dataKey: 'code', fileName: 'shader.frag', runDataKey: 'executeCode' }
];

export interface RepresentationObject {
  id: string;
  metadata: {
    format: typeof PATCH_REPRESENTATION_VERSION;
    id: string;
    objectType: string;
    files: string[];
  };
  files: Record<string, string>;
}

export interface PatchRepresentation {
  format: typeof PATCH_REPRESENTATION_VERSION;
  patchId: string;
  objects: RepresentationObject[];
}

export type FileWriteResult =
  | {
      status: 'applied';
      nodeId: string;
      dataKey: string;
      oldValue: string;
      newValue: string;
      runDataKey?: string;
    }
  | { status: 'unsupported' }
  | { status: 'unchanged' };

export const buildPatchRepresentation = (patchId: string, nodes: Node[]): PatchRepresentation => ({
  format: PATCH_REPRESENTATION_VERSION,
  patchId,
  objects: buildObjectRepresentations(nodes)
});

export const buildObjectRepresentations = (nodes: Node[]): RepresentationObject[] =>
  nodes.flatMap((node) => buildObjectRepresentation(node));

export const applyRepresentationFileWrite = (
  nodes: Node[],
  path: string,
  content: string
): FileWriteResult => {
  const [nodeId, fileName, ...rest] = path.split('/');
  if (!nodeId || !fileName || rest.length > 0) return { status: 'unsupported' };

  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node?.type) return { status: 'unsupported' };

  const adapter = findAdapter(node.type, fileName);
  const value = adapter ? node.data[adapter.dataKey] : undefined;
  if (!adapter || typeof value !== 'string') return { status: 'unsupported' };

  const oldValue = value;
  if (oldValue === content) return { status: 'unchanged' };

  return {
    status: 'applied',
    nodeId,
    dataKey: adapter.dataKey,
    oldValue,
    newValue: content,
    runDataKey: adapter.runDataKey
  };
};

const buildObjectRepresentation = (node: Node): RepresentationObject[] => {
  if (!node.type) return [];

  const files = representationAdapters.flatMap((adapter) => {
    const value = node.data[adapter.dataKey];
    if (adapter.objectType !== node.type || typeof value !== 'string') return [];

    return [[adapter.fileName, value] as const];
  });

  if (files.length === 0) return [];

  return [
    {
      id: node.id,
      metadata: {
        format: PATCH_REPRESENTATION_VERSION,
        id: node.id,
        objectType: node.type,
        files: files.map(([fileName]) => fileName)
      },
      files: Object.fromEntries(files)
    }
  ];
};

const findAdapter = (objectType: string, fileName: string) =>
  representationAdapters.find(
    (adapter) => adapter.objectType === objectType && adapter.fileName === fileName
  );
