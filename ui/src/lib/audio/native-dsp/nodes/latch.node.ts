import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/latch.processor?worker&url';
import { sym } from '$lib/objects/schemas/helpers';

export const LatchNode = createWorkletDspNode({
  type: 'latch~',
  group: 'processors',
  description: 'Sample-and-hold on bang',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [
    {
      name: 'signal',
      type: 'signal',
      description: 'Input signal to sample'
    },
    {
      name: 'trigger',
      type: 'bang',
      description: 'Trigger sample',
      messages: [{ schema: sym('bang'), description: 'Sample the current input value' }]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Held signal value' }],

  tags: ['audio', 'sample', 'hold', 'latch', 'trigger']
});
