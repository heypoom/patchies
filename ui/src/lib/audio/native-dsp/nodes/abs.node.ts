import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/abs.processor?worker&url';

export const AbsNode = createWorkletDspNode({
  type: 'abs~',
  group: 'processors',
  description: 'Absolute value of signal',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [{ name: 'signal', type: 'signal', description: 'Audio input' }],

  outlets: [{ name: 'out', type: 'signal', description: 'Absolute value output' }],

  tags: ['audio', 'math', 'absolute', 'rectify', 'signal']
});
