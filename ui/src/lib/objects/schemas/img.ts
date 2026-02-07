import type { ObjectSchema } from './types';

/**
 * Schema for the img (image display) object.
 */
export const imgSchema: ObjectSchema = {
  type: 'img',
  category: 'video',
  description: 'Load and display images from URLs or files',
  inlets: [
    {
      id: 'message',
      description: 'URL string to load image from'
    }
  ],
  outlets: [],
  tags: ['image', 'picture', 'texture', 'visual'],
  hasDynamicOutlets: true
};
