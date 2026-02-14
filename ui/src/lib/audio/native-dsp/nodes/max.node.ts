import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/max.processor?worker&url';

export const MaxNode = createWorkletDspNode({
  type: 'max~',
  group: 'processors',
  description: 'Per-sample maximum of two signals',

  workletUrl,

  audioInlets: 2,
  audioOutlets: 1,

  inlets: [
    { name: 'left', type: 'signal', description: 'Left signal input' },
    { name: 'right', type: 'signal', description: 'Right signal input' }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Maximum of left and right' }],

  tags: ['audio', 'math', 'maximum', 'signal']
});
