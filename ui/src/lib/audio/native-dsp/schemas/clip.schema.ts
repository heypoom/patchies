import { Type } from '@sinclair/typebox';
import type { DspPortSchema } from '../types';

export const ClipPortSchema: DspPortSchema = {
  inlets: [
    { name: 'signal', type: 'signal', description: 'Audio input' },
    {
      name: 'min',
      type: 'float',
      description: 'Minimum value',
      defaultValue: -1,
      maxPrecision: 3,
      isAudioParam: true,
      minNumber: -10,
      maxNumber: 10,
      messages: [{ schema: Type.Number(), description: 'Minimum clamp value' }]
    },
    {
      name: 'max',
      type: 'float',
      description: 'Maximum value',
      defaultValue: 1,
      maxPrecision: 3,
      isAudioParam: true,
      minNumber: -10,
      maxNumber: 10,
      messages: [{ schema: Type.Number(), description: 'Maximum clamp value' }]
    }
  ],
  outlets: [{ name: 'out', type: 'signal', description: 'Clamped signal output' }]
};
