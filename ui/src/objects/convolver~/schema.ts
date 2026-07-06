import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from '$lib/objects/schemas/types';
import { schema } from '$lib/objects/schemas/types';
import { sym } from '$lib/objects/schemas/helpers';
import { Bang, messages } from '$lib/objects/schemas/common';

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
      type: 'signal',
      description: 'Audio input',
      handle: { handleType: 'audio', handleId: 0 }
    },
    {
      id: 'message',
      description: 'Control messages',
      handle: { handleType: 'message', handleId: 1 },
      messages: [
        { schema: Bang, description: 'Reload impulse response' },
        { schema: Type.Any(), description: 'AudioBuffer impulse response data' }
      ]
    }
  ],
  outlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio output with reverb applied',
      handle: { handleType: 'audio', handleId: 0 }
    }
  ],
  tags: ['audio', 'reverb', 'convolution', 'effects', 'impulse']
};
