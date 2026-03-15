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
  hasDynamicOutlets: true,
  handlePatterns: {
    inlet: { template: 'in-{index}', description: 'Message inlets (0-indexed)' },
    outlet: {
      template: 'video-out-{index}',
      handleType: 'video',
      description: 'Video output at index 0, message outlets use out-{index}'
    }
  }
};
