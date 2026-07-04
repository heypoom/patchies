import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Bang } from '$lib/objects/schemas/common';

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
      handle: { handleType: 'message' },
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
      description: 'Captured screen video',
      handle: { handleType: 'video', handleId: '0' }
    }
  ],
  tags: ['screen', 'capture', 'recording', 'desktop', 'texture', 'visual']
};
