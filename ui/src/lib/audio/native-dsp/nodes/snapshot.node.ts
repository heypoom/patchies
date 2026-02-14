import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/snapshot.processor?worker&url';
import { sym } from '$lib/objects/schemas/helpers';

export const SnapshotNode = createWorkletDspNode({
  type: 'snapshot~',
  group: 'processors',
  description: 'Sample a signal value on bang',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 0,

  inlets: [
    {
      name: 'signal',
      type: 'signal',
      description: 'Signal to sample'
    },
    {
      name: 'bang',
      type: 'bang',
      description: 'Trigger snapshot',
      messages: [{ schema: sym('bang'), description: 'Sample the current value' }]
    }
  ],

  outlets: [{ name: 'value', type: 'message', description: 'Sampled signal value' }],

  tags: ['audio', 'sample', 'snapshot', 'signal', 'message']
});
