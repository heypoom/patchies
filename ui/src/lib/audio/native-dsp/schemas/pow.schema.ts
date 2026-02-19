import { Type } from '@sinclair/typebox';
import type { DspPortSchema } from '../types';

export const PowPortSchema: DspPortSchema = {
  inlets: [
    { name: 'signal', type: 'signal', description: 'Audio input' },
    {
      name: 'exponent',
      type: 'float',
      description: 'Exponent',
      defaultValue: 2,
      maxPrecision: 3,
      isAudioParam: true,
      minNumber: -10,
      maxNumber: 10,
      messages: [{ schema: Type.Number(), description: 'Exponent value' }]
    }
  ],
  outlets: [{ name: 'out', type: 'signal', description: 'Signal raised to power' }]
};
