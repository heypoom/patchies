import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/divide.processor?worker&url';

export const DivideNode = createWorkletDspNode({
  type: '/~',
  group: 'processors',
  description: 'Divide left signal by right signal',

  workletUrl,

  audioInlets: 2,
  audioOutlets: 1,

  inlets: [
    { name: 'left', type: 'signal', description: 'Left signal input (dividend)' },
    { name: 'right', type: 'signal', description: 'Right signal input (divisor)' },
    {
      name: 'value',
      type: 'float',
      hideInlet: true,
      description: 'Constant divisor',
      messages: [{ schema: Type.Number(), description: 'Constant divisor' }]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Quotient of left ÷ right' }],

  tags: ['audio', 'math', 'divide', 'signal']
});
