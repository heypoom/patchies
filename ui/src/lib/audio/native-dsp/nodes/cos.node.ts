import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/cos.processor?worker&url';

export const CosNode = createWorkletDspNode({
  type: 'cos~',
  group: 'processors',
  description: 'Cosine waveshaper (phasor to cosine)',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [{ name: 'phase', type: 'signal', description: 'Phase input (0-1 for full cycle)' }],

  outlets: [{ name: 'out', type: 'signal', description: 'cos(2π × input)' }],

  tags: ['audio', 'math', 'cosine', 'waveshaper', 'oscillator', 'phase']
});
