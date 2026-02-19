import { Type } from '@sinclair/typebox';
import type { DspPortSchema } from '../types';

export const PulsePortSchema: DspPortSchema = {
  inlets: [
    {
      name: 'frequency',
      type: 'float',
      description: 'Frequency in Hz',
      defaultValue: 440,
      precision: 1,
      isAudioParam: true,
      minNumber: 0,
      maxNumber: 20000,
      messages: [{ schema: Type.Number(), description: 'Frequency in Hz' }]
    },
    {
      name: 'width',
      type: 'float',
      description: 'Pulse width (0-1)',
      defaultValue: 0.5,
      maxPrecision: 2,
      isAudioParam: true,
      minNumber: 0,
      maxNumber: 1,
      messages: [
        { schema: Type.Number(), description: 'Pulse width (0 = silent, 0.5 = square, 1 = silent)' }
      ]
    }
  ],
  outlets: [{ name: 'out', type: 'signal', description: 'Pulse wave signal' }]
};
