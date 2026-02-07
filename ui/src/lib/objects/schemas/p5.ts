import type { ObjectSchema } from './types';

/**
 * Schema for the p5 (P5.js canvas) object.
 */
export const p5Schema: ObjectSchema = {
  type: 'p5',
  category: 'video',
  description: 'Creates a P5.js sketch for creative coding and graphics',
  inlets: [
    {
      id: 'message',
      description: 'Receives messages via recv() in your sketch code',
      example: 'recv((msg) => { ... })'
    }
  ],
  outlets: [
    {
      id: 'video',
      description: 'Video output for chaining to other visual nodes (orange port)'
    },
    {
      id: 'message',
      description: 'Message outlets created via setPortCount()'
    }
  ],
  tags: ['canvas', 'graphics', 'animation', 'creative', 'processing', 'drawing', 'visual'],
  hasDynamicOutlets: true
};
