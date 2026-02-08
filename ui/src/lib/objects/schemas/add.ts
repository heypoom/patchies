import type { ObjectSchema } from './types';

/**
 * Schema for the +~ (audio add/sum) object.
 */
export const addSchema: ObjectSchema = {
  type: '+~',
  category: 'audio',
  description: 'Sums multiple audio signals together',
  inlets: [
    {
      id: 'left',
      description: 'Left audio input'
    },
    {
      id: 'right',
      description: 'Right audio input'
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Summed audio output'
    }
  ],
  tags: ['audio', 'math', 'add', 'sum', 'mix']
};
