import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/clip.processor?worker&url';

export const ClipNode = createWorkletDspNode({
  type: 'clip~',
  group: 'processors',
  description: 'Clamp signal to a range',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [
    { name: 'signal', type: 'signal', description: 'Audio input' },
    {
      name: 'min',
      type: 'float',
      description: 'Minimum value',
      defaultValue: -1,
      maxPrecision: 3,
      messages: [{ schema: Type.Number(), description: 'Minimum clamp value' }]
    },
    {
      name: 'max',
      type: 'float',
      description: 'Maximum value',
      defaultValue: 1,
      maxPrecision: 3,
      messages: [{ schema: Type.Number(), description: 'Maximum clamp value' }]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Clamped signal output' }],

  tags: ['audio', 'math', 'clip', 'clamp', 'limit', 'signal']
});
