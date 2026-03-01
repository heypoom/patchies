import { Type } from '@sinclair/typebox';

import type { ObjectSchema } from './types';
import { Bang, Reset, SetMin, SetMax, SetDefault, SetValue } from './common';

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
        { schema: Type.Number(), description: 'Set slider to value and output' },
        { schema: SetMin, description: 'Set the minimum bound' },
        { schema: SetMax, description: 'Set the maximum bound' },
        { schema: SetDefault, description: 'Set the default value (used by reset)' },
        { schema: SetValue, description: 'Set value silently without triggering output' }
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
