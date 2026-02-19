import { createWorkletDspNode } from '../create-worklet-dsp-node';
import { PulsePortSchema } from '../schemas/pulse.schema';
import workletUrl from '../processors/pulse.processor?worker&url';

export const PulseNode = createWorkletDspNode({
  type: 'pulse~',
  group: 'sources',
  description: 'Pulse wave oscillator with PWM',

  workletUrl,

  audioInlets: 0,
  audioOutlets: 1,

  ...PulsePortSchema,

  tags: ['audio', 'oscillator', 'pulse', 'square', 'pwm', 'generator', 'source']
});
