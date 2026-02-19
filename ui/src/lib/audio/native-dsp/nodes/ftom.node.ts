import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/ftom.processor?worker&url';

export const FtomNode = createWorkletDspNode({
  type: 'ftom~',
  group: 'processors',
  description: 'Frequency to MIDI note conversion',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [{ name: 'freq', type: 'signal', description: 'Frequency in Hz' }],

  outlets: [{ name: 'note', type: 'signal', description: 'MIDI note number (fractional)' }],

  tags: ['audio', 'math', 'midi', 'frequency', 'conversion', 'pitch']
});
