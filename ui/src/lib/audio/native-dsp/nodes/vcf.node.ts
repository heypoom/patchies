import { createWorkletDspNode } from '../create-worklet-dsp-node';
import { VcfPortSchema } from '../schemas/vcf.schema';
import workletUrl from '../processors/vcf.processor?worker&url';

export const VcfNode = createWorkletDspNode({
  type: 'vcf~',
  group: 'processors',
  description: 'Voltage-controlled resonant filter with signal-rate frequency modulation',

  workletUrl,

  audioInlets: 2,
  audioOutlets: 2,

  ...VcfPortSchema,

  tags: ['audio', 'filter', 'vcf', 'bandpass', 'lowpass', 'resonant', 'modulation', 'synth']
});
