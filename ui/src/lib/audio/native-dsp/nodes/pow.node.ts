import { createWorkletDspNode } from '../create-worklet-dsp-node';
import { PowPortSchema } from '../schemas/pow.schema';
import workletUrl from '../processors/pow.processor?worker&url';

export const PowNode = createWorkletDspNode({
  type: 'pow~',
  group: 'processors',
  description: 'Raise signal to a power',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  ...PowPortSchema,

  tags: ['audio', 'math', 'power', 'exponent', 'signal']
});
