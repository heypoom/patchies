import { createWorkletDspNode } from '$lib/audio/native-dsp/create-worklet-dsp-node';
import { ClipPortSchema } from '$objects/clip~/native-dsp/schemas/clip.schema';
import workletUrl from '../processors/clip.processor?worker&url';

export const ClipNode = createWorkletDspNode({
  type: 'clip~',
  group: 'processors',
  description: 'Clamp signal to a range',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  ...ClipPortSchema,

  tags: ['audio', 'math', 'clip', 'clamp', 'limit', 'signal']
});
