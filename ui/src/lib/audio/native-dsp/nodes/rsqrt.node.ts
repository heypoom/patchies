import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/rsqrt.processor?worker&url';

export const RsqrtNode = createWorkletDspNode({
  type: 'rsqrt~',
  group: 'processors',
  description: 'Reciprocal square root (1/√x)',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [{ name: 'signal', type: 'signal', description: 'Audio input (positive values)' }],

  outlets: [{ name: 'out', type: 'signal', description: '1/√x output' }],

  tags: ['audio', 'math', 'rsqrt', 'reciprocal', 'sqrt', 'signal']
});
