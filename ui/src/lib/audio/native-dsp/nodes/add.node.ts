import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/add.processor?worker&url';

export const AddNode = createWorkletDspNode({
  type: '+~',
  group: 'processors',
  description: 'Add two audio signals',

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
      description: 'Constant to add',
      messages: [{ schema: Type.Number(), description: 'Constant to add' }]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Sum of left + right' }],

  tags: ['audio', 'math', 'add', 'sum', 'signal']
});
