import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/bang.processor?worker&url';

export const BangNode = createWorkletDspNode({
  type: 'bang~',
  group: 'processors',
  description: 'Emit bang on audio onset',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 0,

  inlets: [
    {
      name: 'signal',
      type: 'signal',
      description: 'Audio input to monitor',
      hideInlet: true
    }
  ],

  outlets: [{ name: 'bang', type: 'bang', description: 'Bang on audio onset' }],

  tags: ['audio', 'bang', 'trigger', 'onset', 'signal']
});
