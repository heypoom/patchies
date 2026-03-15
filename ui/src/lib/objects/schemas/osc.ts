import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the osc~ (oscillator) object.
 */
export const oscSchema: ObjectSchema = {
  type: 'osc~',
  category: 'audio',
  description: 'Oscillator for generating audio waveforms',
  inlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio input for FM modulation',
      handle: { handleType: 'audio', handleId: 0 }
    },
    {
      id: 'frequency',
      description: 'Frequency control',
      handle: { handleType: 'message', handleId: 1 },
      messages: [{ schema: Type.Number(), description: 'Frequency in Hz' }],
      isAudioParam: true
    },
    {
      id: 'type',
      description: 'Waveform type',
      handle: { handleType: 'message', handleId: 2 },
      messages: [
        {
          schema: Type.Union([
            Type.Literal('sine'),
            Type.Literal('square'),
            Type.Literal('sawtooth'),
            Type.Literal('triangle')
          ]),
          description: 'Waveform type'
        },
        {
          schema: Type.Tuple([
            Type.Unsafe<Float32Array>({ type: 'Float32Array' }),
            Type.Unsafe<Float32Array>({ type: 'Float32Array' })
          ]),
          description: 'PeriodicWave [real, imag] arrays for custom waveform'
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
  tags: ['audio', 'oscillator', 'synthesis', 'waveform']
};
