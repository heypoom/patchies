import type { ObjectSchema } from './types';

/**
 * Schema for the p5 (P5.js canvas) object.
 */
export const p5Schema: ObjectSchema = {
  type: 'p5',
  category: 'video',
  description: 'Creates a P5.js sketch for creative coding and graphics',
  inlets: [],
  outlets: [],
  tags: ['canvas', 'graphics', 'animation', 'creative', 'processing', 'drawing', 'visual'],
  hasDynamicOutlets: true
};
