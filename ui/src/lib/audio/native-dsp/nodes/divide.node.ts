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
    {
      name: 'right',
      type: 'signal',
      description: 'Right signal input (divisor)',
      acceptsFloat: true
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Quotient of left ÷ right' }],

  tags: ['audio', 'math', 'divide', 'signal']
});
