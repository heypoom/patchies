import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

export const floatTexSchema: ObjectSchema = {
  type: 'float.tex',
  category: 'video',
  description: 'Pack Float32Array channel data into a 32-bit float video texture',
  inlets: [
    {
      id: 'data',
      description: 'Float32Array channel data or explicit RGBA texture data',
      handle: { handleType: 'message', handleId: '0' },
      messages: [
        {
          schema: Type.Unsafe<Float32Array>({ type: 'Float32Array' }),
          description: 'Single red channel row'
        },
        {
          schema: Type.Array(Type.Unsafe<Float32Array>({ type: 'Float32Array' })),
          description: 'Ordered channel rows'
        },
        {
          schema: Type.Object({
            type: Type.Literal('rgba'),
            data: Type.Unsafe<Float32Array>({ type: 'Float32Array' }),
            width: Type.Number(),
            height: Type.Number()
          }),
          description: 'Interleaved RGBA pixels'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'out',
      type: 'video',
      description: 'RGBA32F texture output',
      handle: { handleType: 'video', handleId: '0' }
    }
  ],
  tags: ['float', 'texture', 'data', 'video', 'glsl', 'chop', 'top']
};
