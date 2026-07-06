import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Bang } from '$lib/objects/schemas/common';

/**
 * Schema for the loadbang (send bang on load) object.
 */
export const loadbangSchema: ObjectSchema = {
  type: 'loadbang',
  category: 'control',
  description: 'Send bang message when patch loads',
  inlets: [],
  outlets: [
    {
      id: 'message',
      description: 'Bang on load',
      handle: { handleType: 'message' },
      messages: [{ schema: Bang, description: 'Sent when patch loads' }]
    }
  ],
  tags: ['control', 'initialization', 'startup', 'trigger']
};
