import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/pink.processor?worker&url';

export const PinkNode = createWorkletDspNode({
  type: 'pink~',
  group: 'sources',
  description: 'Pink noise generator (-3dB/octave)',

  workletUrl,

  audioInlets: 0,
  audioOutlets: 1,

  inlets: [],

  outlets: [{ name: 'out', type: 'signal', description: 'Pink noise signal' }],

  tags: ['audio', 'noise', 'pink', 'generator', 'source']
});
