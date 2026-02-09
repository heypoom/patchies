import { Type } from '@sinclair/typebox';

import type { ObjectSchema } from './types';
import { Bang, Reset } from './common';

/**
 * Schema for the slider (numerical value control) object.
 */
export const sliderSchema: ObjectSchema = {
  type: 'slider',
  category: 'interface',
  description: 'Continuous value control with customizable range',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Bang, description: 'Output the current slider value' },
        { schema: Reset, description: 'Reset the slider value back to its default' },
        { schema: Type.Number(), description: 'Set slider to value and output' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Slider output',
      messages: [{ schema: Type.Number(), description: 'Current slider value' }]
    }
  ],
  tags: ['interface', 'control', 'number', 'range', 'input']
};
