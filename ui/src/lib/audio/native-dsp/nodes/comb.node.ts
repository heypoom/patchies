import { createWorkletDspNode } from '../create-worklet-dsp-node';
import { CombPortSchema } from '../schemas/comb.schema';
import workletUrl from '../processors/comb.processor?worker&url';

export const CombNode = createWorkletDspNode({
  type: 'comb~',
  group: 'processors',
  description: 'Comb filter',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  ...CombPortSchema,

  tags: ['audio', 'filter', 'comb', 'delay', 'karplus-strong', 'flanger']
});
