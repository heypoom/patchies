import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { sym } from './helpers';
import { Bang, messages } from './common';

const Normalize = sym('normalize');

export const convolverMessages = {
  ...messages,
  normalize: schema(Normalize)
};

/**
 * Schema for the convolver~ (convolution reverb) object.
 */
export const convolverSchema: ObjectSchema = {
  type: 'convolver~',
  category: 'audio',
  description: 'Convolution reverb using impulse responses',
  inlets: [
    {
      id: 'audio',
      description: 'Audio input'
    },
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Bang, description: 'Reload impulse response' },
        { schema: Type.Any(), description: 'AudioBuffer impulse response data' }
      ]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Audio output with reverb applied'
    }
  ],
  tags: ['audio', 'reverb', 'convolution', 'effects', 'impulse']
};
