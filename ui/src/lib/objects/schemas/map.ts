import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the map (transform messages) object.
 */
export const mapSchema: ObjectSchema = {
  type: 'map',
  category: 'programming',
  description: 'Transform incoming messages using JavaScript expressions',
  inlets: [
    {
      id: 'hot',
      description: 'Hot inlet ($1) - triggers evaluation',
      messages: [{ schema: Type.Any(), description: 'Value stored as $1, triggers transformation' }]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Transformed output',
      messages: [{ schema: Type.Any(), description: 'Result of the JavaScript expression' }]
    }
  ],
  tags: ['programming', 'map', 'transform', 'javascript', 'control'],
  hasDynamicOutlets: true
};
