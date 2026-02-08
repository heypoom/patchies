import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the compressor~ (dynamic range compressor) object.
 */
export const compressorSchema: ObjectSchema = {
  type: 'compressor~',
  category: 'audio',
  description: 'Dynamic range compressor for audio signals',
  inlets: [
    {
      id: 'audio',
      description: 'Audio input'
    },
    {
      id: 'threshold',
      description: 'Threshold level',
      messages: [
        { schema: Type.Number(), description: 'Decibel value above which compression starts' }
      ]
    },
    {
      id: 'knee',
      description: 'Knee width',
      messages: [
        { schema: Type.Number(), description: 'Decibel range for smooth transition (0-40)' }
      ]
    },
    {
      id: 'ratio',
      description: 'Compression ratio',
      messages: [
        {
          schema: Type.Number(),
          description: 'Amount of dB change in input for 1 dB change in output'
        }
      ]
    },
    {
      id: 'attack',
      description: 'Attack time',
      messages: [{ schema: Type.Number(), description: 'Time in seconds to reduce gain by 10dB' }]
    },
    {
      id: 'release',
      description: 'Release time',
      messages: [{ schema: Type.Number(), description: 'Time in seconds to increase gain by 10dB' }]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Compressed audio output'
    }
  ],
  tags: ['audio', 'dynamics', 'compressor', 'limiter']
};
