import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/multiply.processor?worker&url';

export const MultiplyNode = createWorkletDspNode({
  type: '*~',
  group: 'processors',
  description: 'Multiply two audio signals',

  workletUrl,

  audioInlets: 2,
  audioOutlets: 1,

  inlets: [
    { name: 'left', type: 'signal', description: 'Left signal input' },
    { name: 'right', type: 'signal', description: 'Right signal input' }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Product of left × right' }],

  tags: ['audio', 'math', 'multiply', 'ring modulation', 'signal']
});
