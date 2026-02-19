import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/sqrt.processor?worker&url';

export const SqrtNode = createWorkletDspNode({
  type: 'sqrt~',
  group: 'processors',
  description: 'Square root of signal',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [{ name: 'signal', type: 'signal', description: 'Audio input (non-negative values)' }],

  outlets: [{ name: 'out', type: 'signal', description: 'Square root output' }],

  tags: ['audio', 'math', 'sqrt', 'root', 'signal']
});
