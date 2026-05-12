import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

const formatSchema = Type.Union([
  Type.Literal('r'),
  Type.Literal('rg'),
  Type.Literal('rgb'),
  Type.Literal('rgba')
]);

const textureFormatSchema = Type.Union([
  Type.Literal('rgba8'),
  Type.Literal('rgba16f'),
  Type.Literal('rgba32f')
]);

const float32ChannelSchema = Type.Union([
  Type.Unsafe<Float32Array>({ type: 'Float32Array' }),
  Type.Array(Type.Unsafe<Float32Array>({ type: 'Float32Array' }))
]);

const sharedChannelSchema = Type.Union([
  Type.Unsafe<SharedArrayBuffer>({ type: 'SharedArrayBuffer' }),
  Type.Array(Type.Unsafe<SharedArrayBuffer>({ type: 'SharedArrayBuffer' }))
]);

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
            type: Type.Literal('wrapped'),
            channels: float32ChannelSchema,
            width: Type.Number(),
            format: Type.Optional(formatSchema),
            textureFormat: Type.Optional(textureFormatSchema)
          }),
          description: 'Wrapped channel rows'
        },
        {
          schema: Type.Object({
            type: Type.Literal('wrapped'),
            channels: sharedChannelSchema,
            width: Type.Number(),
            version: Type.Number(),
            format: Type.Optional(formatSchema),
            textureFormat: Type.Optional(textureFormatSchema)
          }),
          description: 'Shared wrapped channel rows'
        },
        {
          schema: Type.Object({
            type: Type.Literal('square'),
            channels: float32ChannelSchema,
            format: Type.Optional(formatSchema),
            textureFormat: Type.Optional(textureFormatSchema)
          }),
          description: 'Square channel texture'
        },
        {
          schema: Type.Object({
            type: Type.Literal('square'),
            channels: sharedChannelSchema,
            version: Type.Number(),
            format: Type.Optional(formatSchema),
            textureFormat: Type.Optional(textureFormatSchema)
          }),
          description: 'Shared square channel texture'
        },
        {
          schema: Type.Object({
            type: formatSchema,
            data: Type.Unsafe<Float32Array>({ type: 'Float32Array' }),
            width: Type.Number(),
            height: Type.Number(),
            textureFormat: Type.Optional(textureFormatSchema)
          }),
          description: 'Interleaved pixel data'
        },
        {
          schema: Type.Object({
            type: formatSchema,
            buffer: Type.Unsafe<SharedArrayBuffer>({ type: 'SharedArrayBuffer' }),
            width: Type.Number(),
            height: Type.Number(),
            version: Type.Number(),
            textureFormat: Type.Optional(textureFormatSchema)
          }),
          description: 'Shared interleaved pixel data'
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
