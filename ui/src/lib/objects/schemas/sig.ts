import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the sig~ (constant signal) object.
 */
export const sigSchema: ObjectSchema = {
  type: 'sig~',
  category: 'audio',
  description: 'Outputs a constant signal value',
  inlets: [
    {
      id: 'offset',
      description: 'Constant value',
      messages: [{ schema: Type.Number(), description: 'Constant signal value' }]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Constant signal output'
    }
  ],
  tags: ['audio', 'signal', 'constant', 'dc']
};
