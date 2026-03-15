import type { ObjectSchema } from './types';

/**
 * Schema for the glsl (GLSL fragment shader) object.
 */
export const glslSchema: ObjectSchema = {
  type: 'glsl',
  category: 'video',
  description: 'Creates a GLSL fragment shader for visual effects',
  inlets: [],
  outlets: [
    {
      id: 'out',
      type: 'video',
      description: 'Video output',
      handle: { handleType: 'video', handleId: 'out' }
    }
  ],
  tags: ['shader', 'visual', 'graphics', 'opengl', 'gpu', 'shadertoy'],
  hasDynamicOutlets: false,
  handlePatterns: {
    inlet: {
      template: 'video-in-{index}-{name}-{type}',
      handleType: 'video',
      description:
        'Uniform-based inlets: index-uniformName-uniformType (e.g. 0-iChannel0-sampler2D)'
    }
  }
};
