import { Type } from '@sinclair/typebox';
import type { DspPortSchema } from '../types';

export const BeatPortSchema: DspPortSchema = {
  inlets: [
    {
      name: 'multiply',
      type: 'float',
      description: 'Beat frequency multiplier (0.25 = per bar, 1 = per beat, 2 = 8ths)',
      defaultValue: 1,
      maxPrecision: 3,
      isAudioParam: true,
      minNumber: 0,
      maxNumber: 256,
      messages: [{ schema: Type.Number(), description: 'Beat frequency multiplier' }]
    }
  ],
  outlets: [
    {
      name: 'out',
      type: 'signal',
      description: 'Beat phase ramp (0 to 1)'
    }
  ]
};
