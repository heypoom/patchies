import { Type } from '@sinclair/typebox';
import type { DspPortSchema } from '../types';

export const SlopPortSchema: DspPortSchema = {
  inlets: [
    {
      name: 'signal',
      type: 'signal',
      description: 'Audio input'
    },
    {
      name: 'limit',
      type: 'float',
      description: 'Slew rate limit (units per second)',
      defaultValue: 1,
      minNumber: 0,
      maxPrecision: 4,
      isAudioParam: true,
      messages: [{ schema: Type.Number(), description: 'Slew rate limit (units/second)' }]
    }
  ],
  outlets: [{ name: 'out', type: 'signal', description: 'Slew-limited output' }]
};
