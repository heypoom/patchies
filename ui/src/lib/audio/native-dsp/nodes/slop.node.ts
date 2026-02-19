import { createWorkletDspNode } from '../create-worklet-dsp-node';
import { SlopPortSchema } from '../schemas/slop.schema';
import workletUrl from '../processors/slop.processor?worker&url';

export const SlopNode = createWorkletDspNode({
  type: 'slop~',
  group: 'processors',
  description: 'Slew-limiting low-pass filter for smooth transitions',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  ...SlopPortSchema,

  tags: ['audio', 'filter', 'slew', 'smooth', 'portamento', 'glide', 'limiter']
});
