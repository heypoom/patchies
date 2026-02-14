import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/wrap.processor?worker&url';

export const WrapNode = createWorkletDspNode({
  type: 'wrap~',
  group: 'processors',
  description: 'Wrap signal to [0, 1) range',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [{ name: 'signal', type: 'signal', description: 'Audio input' }],

  outlets: [{ name: 'out', type: 'signal', description: 'Wrapped signal (0 to 1)' }],

  tags: ['audio', 'math', 'wrap', 'phase', 'signal']
});
