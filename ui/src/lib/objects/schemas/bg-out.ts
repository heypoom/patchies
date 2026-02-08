import type { ObjectSchema } from './types';

/**
 * Schema for the bg.out (background output) object.
 */
export const bgOutSchema: ObjectSchema = {
  type: 'bg.out',
  category: 'visual',
  description: 'Set the final visual output that appears as the background',
  inlets: [
    {
      id: 'video',
      description: 'Video input to display as background'
    }
  ],
  outlets: [],
  tags: ['visual', 'output', 'background', 'display']
};
