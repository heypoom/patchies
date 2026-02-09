import type { ObjectSchema } from './types';

/**
 * Schema for the glsl (GLSL fragment shader) object.
 */
export const glslSchema: ObjectSchema = {
  type: 'glsl',
  category: 'video',
  description: 'Creates a GLSL fragment shader for visual effects',
  inlets: [],
  outlets: [],
  tags: ['shader', 'visual', 'graphics', 'opengl', 'gpu', 'shadertoy'],
  hasDynamicOutlets: true
};
