import type { Edge, Node } from '@xyflow/svelte';
import { DEFAULT_GLSL_CODE } from '$lib/canvas/constants';
import { shaderCodeToUniformDefs } from '$lib/canvas/shader-code-to-uniform-def';

const EDGE_INSERTION_PASSTHRU_CODE = `uniform sampler2D source;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = texture(source, uv);
}`;

/**
 * A new GLSL object is a generator by default and has no video inlet. When it is
 * inserted into a video edge, start it as a pass-through effect so the connection
 * represents a real visual chain that the user can edit from there.
 */
export function prepareGlslForEdgeInsertion(node: Node, edge: Edge): Node {
  const code = (node.data as { code?: unknown } | undefined)?.code;
  if (code !== DEFAULT_GLSL_CODE || !edge.sourceHandle?.startsWith('video-out')) return node;

  return {
    ...node,
    data: {
      ...node.data,
      code: EDGE_INSERTION_PASSTHRU_CODE,
      glUniformDefs: shaderCodeToUniformDefs(EDGE_INSERTION_PASSTHRU_CODE)
    }
  };
}
