import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/pow.processor?worker&url';

export const PowNode = createWorkletDspNode({
  type: 'pow~',
  group: 'processors',
  description: 'Raise signal to a power',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [
    { name: 'signal', type: 'signal', description: 'Audio input' },
    {
      name: 'exponent',
      type: 'float',
      description: 'Exponent',
      defaultValue: 2,
      maxPrecision: 3,
      messages: [{ schema: Type.Number(), description: 'Exponent value' }]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Signal raised to power' }],

  tags: ['audio', 'math', 'power', 'exponent', 'signal']
});
