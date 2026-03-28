import type { ObjectSchema } from './types';

/**
 * Schema for the title object.
 */
export const titleSchema: ObjectSchema = {
  type: 'title',
  category: 'ui',
  description: 'A resizable title label with centered text for diagrams and presentations.',
  inlets: [],
  outlets: [],
  tags: ['diagram', 'label', 'presentation', 'text', 'title', 'ui']
};
