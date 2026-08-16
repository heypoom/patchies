import type { Edge, Node } from '@xyflow/svelte';
import { DEFAULT_GLSL_CODE } from '$lib/canvas/constants';
import { shaderCodeToUniformDefs } from '$lib/canvas/shader-code-to-uniform-def';
import { preset as glslPipePreset } from '$presets/glsl/passthru';

/**
 * GLSL pipe presets expose their sampler uniforms dynamically. Derive those handles
 * before edge compatibility is evaluated. A bare GLSL generator is upgraded to an
 * editable pass-through shader when inserted into a video edge.
 */
export function prepareGlslForEdgeInsertion(node: Node, edge: Edge): Node {
  const code = (node.data as { code?: unknown } | undefined)?.code;
  if (!edge.sourceHandle?.startsWith('video-out') || typeof code !== 'string') return node;

  const edgeInsertionCode = code === DEFAULT_GLSL_CODE ? glslPipePreset.data.code : code;

  return {
    ...node,
    data: {
      ...node.data,
      code: edgeInsertionCode,
      glUniformDefs: shaderCodeToUniformDefs(edgeInsertionCode)
    }
  };
}
