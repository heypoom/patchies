import type { ObjectSchema } from './types';

/**
 * Schema for the swgl (SwissGL shader) object.
 */
export const swglSchema: ObjectSchema = {
  type: 'swgl',
  category: 'video',
  description: 'Creates a SwissGL shader for WebGL2 graphics',
  inlets: [],
  outlets: [],
  tags: ['shader', 'webgl', 'graphics', 'gpu', '3d', 'mesh'],
  hasDynamicOutlets: true
};
