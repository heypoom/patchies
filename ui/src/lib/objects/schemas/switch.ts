import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the switch object.
 */
export const switchSchema: ObjectSchema = {
  type: 'switch',
  category: 'interface',
  description: 'A horizontal switch that sends true/false when toggled',
  inlets: [],
  outlets: [
    {
      id: 'message',
      description: 'Switch output',
      messages: [{ schema: Type.Boolean(), description: 'Current state' }]
    }
  ],
  tags: ['interface', 'control', 'switch', 'boolean', 'input']
};
