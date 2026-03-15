import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the waveshaper~ (distortion) object.
 */
export const waveshaperSchema: ObjectSchema = {
  type: 'waveshaper~',
  category: 'audio',
  description: 'Distortion and waveshaping effects',
  inlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio input',
      handle: { handleType: 'audio', handleId: 0 }
    },
    {
      id: 'curve',
      description: 'Distortion curve',
      handle: { handleType: 'message', handleId: 1 },
      messages: [{ schema: Type.Any(), description: 'Float32Array distortion curve' }]
    },
    {
      id: 'oversample',
      description: 'Oversampling mode',
      handle: { handleType: 'message', handleId: 2 },
      messages: [
        {
          schema: Type.Union([Type.Literal('none'), Type.Literal('2x'), Type.Literal('4x')]),
          description: 'Oversampling factor'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio output',
      handle: { handleType: 'audio', handleId: 0 }
    }
  ],
  tags: ['audio', 'distortion', 'waveshaper', 'effects']
};
