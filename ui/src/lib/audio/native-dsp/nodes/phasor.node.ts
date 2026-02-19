import { createWorkletDspNode } from '../create-worklet-dsp-node';
import { PhasorPortSchema } from '../schemas/phasor.schema';
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
