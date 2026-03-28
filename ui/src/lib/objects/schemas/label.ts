import type { ObjectSchema } from './types';

/**
 * Schema for the label object.
 */
export const labelSchema: ObjectSchema = {
  type: 'label',
  category: 'ui',
  description: 'A simple text label for annotations and notes in your patch.',
  inlets: [],
  outlets: [],
  tags: ['annotation', 'label', 'text', 'ui']
};
