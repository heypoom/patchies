import { createWorkletDspNode } from '$lib/audio/native-dsp/create-worklet-dsp-node';
import { PhasorPortSchema } from '$objects/phasor~/native-dsp/schemas/phasor.schema';
import workletUrl from '../processors/phasor.processor?worker&url';

export const PhasorNode = createWorkletDspNode({
  type: 'phasor~',
  group: 'sources',
  description: 'Sawtooth ramp oscillator (0 to 1)',

  workletUrl,

  audioInlets: 0,
  audioOutlets: 1,

  ...PhasorPortSchema,

  tags: ['audio', 'oscillator', 'ramp', 'phasor', 'signal']
});
