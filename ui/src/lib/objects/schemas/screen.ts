import type { ObjectSchema } from './types';
import { Bang } from './common';

/**
 * Schema for the screen capture object.
 */
export const screenSchema: ObjectSchema = {
  type: 'screen',
  category: 'video',
  description: 'Screen capture for desktop/window recording',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        {
          schema: Bang,
          description: 'Start screen capture'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'out',
      type: 'video',
      description: 'Captured screen video'
    }
  ],
  tags: ['screen', 'capture', 'recording', 'desktop', 'texture', 'visual']
};
