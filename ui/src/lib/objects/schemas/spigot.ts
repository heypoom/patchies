import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the spigot object.
 */
export const spigotSchema: ObjectSchema = {
  type: 'spigot',
  category: 'control',
  description: 'Message gate that allows or blocks data based on condition',
  inlets: [
    {
      id: 'data',
      description: 'Data input',
      messages: [{ schema: Type.Any(), description: 'Data to pass through when allowed' }]
    },
    {
      id: 'control',
      description: 'Gate control',
      messages: [
        { schema: Type.Boolean(), description: 'Truthy allows data, falsey blocks data' },
        { schema: Type.Literal('bang'), description: 'Bang toggles gate state' }
      ]
    }
  ],
  outlets: [
    {
      id: 'out',
      description: 'Output when spigot is open'
    }
  ],
  tags: ['control', 'gate', 'switch', 'filter']
};
