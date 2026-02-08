import type { ObjectSchema } from './types';

/**
 * Schema for the out~ (audio output) object.
 */
export const outSchema: ObjectSchema = {
  type: 'out~',
  category: 'audio',
  description: 'Audio output to speakers',
  inlets: [
    {
      id: 'audio',
      description: 'Audio signal to output'
    }
  ],
  outlets: [],
  tags: ['audio', 'output', 'speakers', 'destination']
};
