import type { ObjectSchema } from '$lib/objects/schemas/types';

export const groupSchema: ObjectSchema = {
  type: 'group',
  category: 'ui',
  description: 'A resizable frame that visually groups objects and moves them together.',
  inlets: [],
  outlets: [],
  tags: ['group', 'organization', 'annotation', 'ui']
};
