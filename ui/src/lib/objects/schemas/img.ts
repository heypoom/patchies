import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';

// Image-specific message schemas
const LoadUrl = msg('load', { url: Type.String() });
const LoadPath = msg('load', { path: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const imgMessages = {
  loadUrl: schema(LoadUrl),
  loadPath: schema(LoadPath)
};

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
      description: 'Control messages',
      messages: [
        { schema: LoadUrl, description: 'Load image from URL' },
        { schema: LoadPath, description: 'Load image from file path' },
        { schema: Type.String(), description: 'Load image from path' }
      ]
    }
  ],
  outlets: [],
  tags: ['image', 'picture', 'texture', 'visual'],
  hasDynamicOutlets: true
};
