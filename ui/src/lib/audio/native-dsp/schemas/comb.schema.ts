import { Type } from '@sinclair/typebox';
import type { DspPortSchema } from '../types';

export const CombPortSchema: DspPortSchema = {
  inlets: [
    {
      name: 'signal',
      type: 'signal',
      description: 'Audio input'
    },
    {
      name: 'delay',
      type: 'float',
      description: 'Delay time in ms',
      defaultValue: 10,
      maxPrecision: 2,
      isAudioParam: true,
      audioParamAutomationRate: 'k-rate', // k-rate: delay changes are smoothed per-block
      minNumber: 0.02,
      maxNumber: 1000,
      messages: [{ schema: Type.Number(), description: 'Delay time in milliseconds' }]
    },
    {
      name: 'feedback',
      type: 'float',
      description: 'Feedback amount (-0.999 to 0.999)',
      defaultValue: 0.7,
      maxPrecision: 3,
      isAudioParam: true,
      minNumber: -0.999,
      maxNumber: 0.999,
      messages: [{ schema: Type.Number(), description: 'Feedback coefficient' }]
    }
  ],
  outlets: [{ name: 'out', type: 'signal', description: 'Filtered signal output' }]
};
