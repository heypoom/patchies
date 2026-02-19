import { createWorkletDspNode } from '../create-worklet-dsp-node';
import { BiquadPortSchema } from '../schemas/biquad.schema';
import workletUrl from '../processors/biquad.processor?worker&url';

export const BiquadNode = createWorkletDspNode({
  type: 'biquad~',
  group: 'processors',
  description: '2nd order filter with direct coefficient control',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  ...BiquadPortSchema,

  tags: ['audio', 'filter', 'biquad', 'iir', 'coefficients', 'custom']
});
