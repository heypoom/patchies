import { Type } from '@sinclair/typebox';

import type { ObjectSchema } from './types';
import { Bang, Reset } from './common';

/**
 * Schema for the knob (circular encoder) object.
 */
export const knobSchema: ObjectSchema = {
  type: 'knob',
  category: 'interface',
  description: 'Circular encoder knob for continuous value control (0-1 by default)',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Bang, description: 'Output the current knob value' },
        { schema: Reset, description: 'Reset the knob value back to its default' },
        { schema: Type.Number(), description: 'Set knob to value and output' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Knob output',
      messages: [{ schema: Type.Number(), description: 'Current knob value' }]
    }
  ],
  tags: ['interface', 'control', 'number', 'encoder', 'input']
};
