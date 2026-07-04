import { createWorkletDspNode } from '$lib/audio/native-dsp/create-worklet-dsp-node';
import { Tabosc4PortSchema } from '$objects/table-audio/native-dsp/schemas/tabosc4.schema';
import workletUrl from '../processors/tabosc4.processor?worker&url';

export const Tabosc4Node = createWorkletDspNode({
  type: 'tabosc4~',
  group: 'sources',
  description: 'Wavetable oscillator with 4-point interpolation',

  workletUrl,

  audioInlets: 0,
  audioOutlets: 1,

  ...Tabosc4PortSchema,

  tags: ['audio', 'oscillator', 'wavetable', 'table', 'synthesis']
});
