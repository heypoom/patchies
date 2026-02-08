import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { Bang, messages } from './common';

/** Pre-wrapped matchers for use with ts-pattern */
export const sliderMessages = {
  ...messages
};

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
