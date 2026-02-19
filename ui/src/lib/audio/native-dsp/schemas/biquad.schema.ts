import { Type } from '@sinclair/typebox';
import type { DspPortSchema } from '../types';

export const BiquadPortSchema: DspPortSchema = {
  inlets: [
    {
      name: 'signal',
      type: 'signal',
      description: 'Audio input to filter'
    },
    {
      name: 'ff1',
      type: 'float',
      description: 'Feedforward coefficient 1 (b0)',
      defaultValue: 1,
      maxPrecision: 6,
      isAudioParam: true,
      messages: [{ schema: Type.Number(), description: 'Feedforward coef 1 (current sample)' }]
    },
    {
      name: 'ff2',
      type: 'float',
      description: 'Feedforward coefficient 2 (b1)',
      defaultValue: 0,
      maxPrecision: 6,
      isAudioParam: true,
      messages: [{ schema: Type.Number(), description: 'Feedforward coef 2 (x[n-1])' }]
    },
    {
      name: 'ff3',
      type: 'float',
      description: 'Feedforward coefficient 3 (b2)',
      defaultValue: 0,
      maxPrecision: 6,
      isAudioParam: true,
      messages: [{ schema: Type.Number(), description: 'Feedforward coef 3 (x[n-2])' }]
    },
    {
      name: 'fb1',
      type: 'float',
      description: 'Feedback coefficient 1 (a1)',
      defaultValue: 0,
      maxPrecision: 6,
      isAudioParam: true,
      messages: [{ schema: Type.Number(), description: 'Feedback coef 1 (y[n-1])' }]
    },
    {
      name: 'fb2',
      type: 'float',
      description: 'Feedback coefficient 2 (a2)',
      defaultValue: 0,
      maxPrecision: 6,
      isAudioParam: true,
      messages: [{ schema: Type.Number(), description: 'Feedback coef 2 (y[n-2])' }]
    }
  ],
  outlets: [{ name: 'out', type: 'signal', description: 'Filtered signal output' }]
};
