import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/gt.processor?worker&url';

export const GtNode = createWorkletDspNode({
  type: '>~',
  group: 'processors',
  description: 'Output 1 if left > right, else 0',

  workletUrl,

  audioInlets: 2,
  audioOutlets: 1,

  inlets: [
    { name: 'left', type: 'signal', description: 'Left signal input' },
    { name: 'right', type: 'signal', description: 'Right signal input' }
  ],

  outlets: [{ name: 'out', type: 'signal', description: '1 if left > right, else 0' }],

  tags: ['audio', 'math', 'compare', 'greater', 'gate', 'signal']
});
