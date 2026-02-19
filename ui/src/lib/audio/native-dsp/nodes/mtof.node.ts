import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/mtof.processor?worker&url';

export const MtofNode = createWorkletDspNode({
  type: 'mtof~',
  group: 'processors',
  description: 'MIDI note to frequency conversion',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [{ name: 'note', type: 'signal', description: 'MIDI note number (0-127)' }],

  outlets: [{ name: 'freq', type: 'signal', description: 'Frequency in Hz' }],

  tags: ['audio', 'math', 'midi', 'frequency', 'conversion', 'pitch']
});
