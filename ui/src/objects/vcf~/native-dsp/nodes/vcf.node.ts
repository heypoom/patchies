import { createWorkletDspNode } from '$lib/audio/native-dsp/create-worklet-dsp-node';
import { VcfPortSchema } from '$objects/vcf~/native-dsp/schemas/vcf.schema';
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
