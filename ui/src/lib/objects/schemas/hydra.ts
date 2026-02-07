import type { ObjectSchema } from './types';

/**
 * Schema for the hydra (Hydra video synthesizer) object.
 */
export const hydraSchema: ObjectSchema = {
  type: 'hydra',
  category: 'video',
  description: 'Creates a Hydra live coding video synthesizer',
  inlets: [],
  outlets: [],
  tags: ['video', 'synthesizer', 'livecoding', 'visual', 'shader', 'generative'],
  hasDynamicOutlets: true
};
