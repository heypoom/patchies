import type { ObjectSchema } from './types';

/**
 * Schema for the textmode (offscreen ASCII graphics) object.
 */
export const textmodeSchema: ObjectSchema = {
  type: 'textmode',
  category: 'video',
  description: 'Creates ASCII/text-mode graphics using textmode.js',
  inlets: [],
  outlets: [],
  tags: ['ascii', 'text', 'retro', 'characters', 'webgl'],
  hasDynamicOutlets: true,
  handlePatterns: {
    inlet: { template: 'in-{index}' },
    outlet: { template: 'out-{index}' }
  }
};

/**
 * Schema for the textmode.dom (main thread ASCII graphics) object.
 */
export const textmodeDomSchema: ObjectSchema = {
  type: 'textmode.dom',
  category: 'video',
  description: 'Creates ASCII/text-mode graphics with mouse/keyboard support',
  inlets: [],
  outlets: [],
  tags: ['ascii', 'text', 'retro', 'characters', 'webgl', 'interactive'],
  hasDynamicOutlets: true,
  handlePatterns: {
    inlet: { template: 'in-{index}' },
    outlet: { template: 'out-{index}' }
  }
};
