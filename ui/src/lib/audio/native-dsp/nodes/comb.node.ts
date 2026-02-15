import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/comb.processor?worker&url';

export const CombNode = createWorkletDspNode({
  type: 'comb~',
  group: 'processors',
  description: 'Comb filter',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

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
      minNumber: 0.02,
      maxPrecision: 2,
      messages: [{ schema: Type.Number(), description: 'Delay time in milliseconds' }]
    },
    {
      name: 'feedback',
      type: 'float',
      description: 'Feedback amount (-0.999 to 0.999)',
      defaultValue: 0.7,
      minNumber: -0.999,
      maxNumber: 0.999,
      maxPrecision: 3,
      messages: [{ schema: Type.Number(), description: 'Feedback coefficient' }]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Filtered signal output' }],

  tags: ['audio', 'filter', 'comb', 'delay', 'karplus-strong', 'flanger']
});
