import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/env.processor?worker&url';

export const EnvNode = createWorkletDspNode({
  type: 'env~',
  group: 'processors',
  description: 'RMS envelope follower',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 0,

  inlets: [
    {
      name: 'signal',
      type: 'signal',
      description: 'Audio input to analyze'
    },
    {
      name: 'window',
      type: 'float',
      description: 'Analysis window size in samples',
      defaultValue: 1024,
      minNumber: 1,
      precision: 0,
      messages: [{ schema: Type.Number(), description: 'Window size in samples' }]
    }
  ],

  outlets: [{ name: 'rms', type: 'message', description: 'RMS amplitude value' }],

  tags: ['audio', 'envelope', 'follower', 'rms', 'analysis']
});
