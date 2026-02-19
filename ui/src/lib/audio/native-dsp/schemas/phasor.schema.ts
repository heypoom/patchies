import { Type } from '@sinclair/typebox';
import type { DspPortSchema } from '../types';

export const PhasorPortSchema: DspPortSchema = {
  inlets: [
    {
      name: 'frequency',
      type: 'float',
      description: 'Frequency in Hz',
      defaultValue: 0,
      maxPrecision: 2,
      isAudioParam: true,
      minNumber: 0,
      maxNumber: 20000,
      messages: [{ schema: Type.Number(), description: 'Frequency in Hz' }]
    },
    {
      name: 'phase',
      type: 'float',
      description: 'Phase reset (0 to 1)',
      defaultValue: 0,
      maxPrecision: 3,
      hideTextParam: true,
      messages: [{ schema: Type.Number(), description: 'Phase reset value (0 to 1)' }]
    }
  ],
  outlets: [
    {
      name: 'out',
      type: 'signal',
      description: 'Ramp output (0 to 1)'
    }
  ]
};
