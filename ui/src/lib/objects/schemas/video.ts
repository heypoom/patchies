import type { ObjectSchema } from './types';

/**
 * Schema for the video (video display) object.
 */
export const videoSchema: ObjectSchema = {
  type: 'video',
  category: 'video',
  description: 'Load and display videos from URLs or files',
  inlets: [
    {
      id: 'message',
      description:
        'Controls: bang (restart), play, pause, URL string, or {type: "loop", value: boolean}'
    }
  ],
  outlets: [],
  tags: ['video', 'movie', 'texture', 'visual', 'audio'],
  hasDynamicOutlets: true
};
