import type { ObjectSchema } from './types';
import { Bang } from './common';

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
      messages: [{ schema: Bang, description: 'Sent when patch loads' }]
    }
  ],
  tags: ['control', 'initialization', 'startup', 'trigger']
};
