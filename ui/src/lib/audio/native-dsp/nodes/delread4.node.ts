import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/delread4.processor?worker&url';

export const Delread4Node = createWorkletDspNode({
  type: 'delread4~',
  group: 'processors',
  description: 'Read from delay line with 4-point interpolation for variable delays',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [
    {
      name: 'delay',
      type: 'signal',
      description: 'Delay time in ms (signal rate)'
    },
    {
      name: 'name',
      type: 'string',
      hideInlet: true,
      description: 'Delay line name',
      defaultValue: 'delay',
      messages: [{ schema: Type.String(), description: 'Set delay line name' }]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Delayed signal output (interpolated)' }],

  tags: ['audio', 'delay', 'buffer', 'read', 'interpolation', 'chorus', 'flanger', 'effect']
});
