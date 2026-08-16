import type { Edge, Node } from '@xyflow/svelte';
import { prepareGlslForEdgeInsertion } from '$objects/glsl/edge-insertion';
import { OBJECT_PIPE_PRESETS } from '$lib/presets/preset-packs';
import { PRESETS } from '$lib/presets/presets';

type EdgeInsertionAdapter = (node: Node, edge: Edge) => Node;

const adapters: Record<string, EdgeInsertionAdapter | undefined> = {
  glsl: prepareGlslForEdgeInsertion,
  hydra: prepareVideoPipeForEdgeInsertion,
  three: prepareVideoPipeForEdgeInsertion,
  regl: prepareVideoPipeForEdgeInsertion
};

/** Uses an object's companion pipe preset when that object is inserted into an edge. */
export function getEdgeInsertionObjectName(name: string): string {
  const pipePresetName = `${name}>`;
  return OBJECT_PIPE_PRESETS.includes(pipePresetName) ? pipePresetName : name;
}

/** Replaces a Quick Insert base object with its companion pipe preset. */
export function applyEdgeInsertionPipePreset(node: Node, objectName: string): Node {
  const presetName = getEdgeInsertionObjectName(objectName);
  const preset = PRESETS[presetName];
  if (presetName === objectName || !preset) return node;

  return {
    ...node,
    type: preset.type,
    data: preset.data as Record<string, unknown>
  };
}

function prepareVideoPipeForEdgeInsertion(node: Node, edge: Edge): Node {
  if (!edge.sourceHandle?.startsWith('video-out')) return node;

  return {
    ...node,
    data: {
      ...node.data,
      videoInletCount: (node.data?.videoInletCount as number | undefined) ?? 1,
      videoOutletCount: (node.data?.videoOutletCount as number | undefined) ?? 1
    }
  };
}

/** Applies object-owned setup needed before a node can be connected into an edge. */
export const prepareNodeForEdgeInsertion = (node: Node, edge: Edge): Node =>
  adapters[node.type ?? '']?.(node, edge) ?? node;
