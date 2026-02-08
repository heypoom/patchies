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
      description: 'Audio input for FM modulation'
    },
    {
      id: 'frequency',
      description: 'Frequency control',
      messages: [{ schema: Type.Number(), description: 'Frequency in Hz' }]
    },
    {
      id: 'type',
      description: 'Waveform type',
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
          schema: Type.Tuple([Type.Any(), Type.Any()]),
          description: 'PeriodicWave [real, imag] arrays for custom waveform'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Audio output'
    }
  ],
  tags: ['audio', 'oscillator', 'synthesis', 'waveform']
};
