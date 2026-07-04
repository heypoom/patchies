import type { ObjectSchema } from '$lib/objects/schemas/types';

/**
 * Schema for the link object.
 */
export const linkSchema: ObjectSchema = {
  type: 'link',
  category: 'ui',
  description: 'A clickable hyperlink button that opens a URL in a new tab.',
  inlets: [],
  outlets: [],
  tags: ['button', 'hyperlink', 'link', 'ui', 'url']
};
