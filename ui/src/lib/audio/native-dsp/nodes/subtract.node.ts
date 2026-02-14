import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/subtract.processor?worker&url';

export const SubtractNode = createWorkletDspNode({
  type: '-~',
  group: 'processors',
  description: 'Subtract right signal from left signal',

  workletUrl,

  audioInlets: 2,
  audioOutlets: 1,

  inlets: [
    { name: 'left', type: 'signal', description: 'Left signal input' },
    { name: 'right', type: 'signal', description: 'Right signal input' },
    {
      name: 'value',
      type: 'float',
      hideInlet: true,
      description: 'Constant to subtract',
      messages: [{ schema: Type.Number(), description: 'Constant to subtract' }]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Difference of left − right' }],

  tags: ['audio', 'math', 'subtract', 'signal']
});
