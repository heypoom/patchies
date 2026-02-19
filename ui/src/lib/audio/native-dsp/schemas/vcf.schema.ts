import { Type } from '@sinclair/typebox';
import type { DspPortSchema } from '../types';

export const VcfPortSchema: DspPortSchema = {
  inlets: [
    {
      name: 'signal',
      type: 'signal',
      description: 'Audio input to filter'
    },
    {
      name: 'frequency',
      type: 'signal',
      description: 'Center frequency in Hz (signal rate)'
    },
    {
      name: 'q',
      type: 'float',
      description: 'Filter resonance (Q factor)',
      defaultValue: 1,
      minNumber: 0.1,
      maxNumber: 100,
      maxPrecision: 2,
      isAudioParam: true,
      messages: [{ schema: Type.Number(), description: 'Q factor (higher = more resonance)' }]
    }
  ],
  outlets: [
    { name: 'bandpass', type: 'signal', description: 'Bandpass filtered output (real)' },
    { name: 'lowpass', type: 'signal', description: 'Lowpass filtered output (imaginary)' }
  ]
};
