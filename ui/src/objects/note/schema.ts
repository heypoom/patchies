import type { ObjectSchema } from '$lib/objects/schemas/types';

/**
 * Schema for the note (post-it) object.
 */
export const noteSchema: ObjectSchema = {
  type: 'note',
  category: 'ui',
  description: 'A resizable post-it note for annotations and comments.',
  inlets: [],
  outlets: [],
  tags: ['annotation', 'comment', 'documentation', 'ui']
};
