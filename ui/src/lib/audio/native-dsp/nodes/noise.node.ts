import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/noise.processor?worker&url';

export const NoiseNode = createWorkletDspNode({
  type: 'noise~',
  group: 'sources',
  description: 'White noise generator',

  workletUrl,

  audioInlets: 0,
  audioOutlets: 1,

  inlets: [],

  outlets: [{ name: 'out', type: 'signal', description: 'White noise output' }],

  tags: ['audio', 'noise', 'random', 'signal']
});
