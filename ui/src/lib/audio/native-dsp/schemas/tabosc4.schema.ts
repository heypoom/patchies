import { Type } from '@sinclair/typebox';
import type { DspPortSchema } from '../types';

export const Tabosc4PortSchema: DspPortSchema = {
  inlets: [
    {
      name: 'frequency',
      type: 'float',
      description: 'Frequency in Hz',
      defaultValue: 440,
      maxPrecision: 2,
      isAudioParam: true,
      minNumber: 0,
      maxNumber: 20000,
      messages: [{ schema: Type.Number(), description: 'Frequency in Hz' }]
    },
    {
      name: 'table',
      type: 'string',
      description: 'Table/buffer name',
      messages: [{ schema: Type.String(), description: 'Set table name' }]
    }
  ],
  outlets: [
    {
      name: 'out',
      type: 'signal',
      description: 'Wavetable oscillator output'
    }
  ]
};
