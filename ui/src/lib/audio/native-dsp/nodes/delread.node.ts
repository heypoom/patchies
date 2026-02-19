import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/delread.processor?worker&url';

export const DelreadNode = createWorkletDspNode({
  type: 'delread~',
  group: 'processors',
  description: 'Read from a named delay line at fixed delay time',

  workletUrl,

  audioInlets: 0,
  audioOutlets: 1,

  inlets: [
    {
      name: 'name',
      type: 'string',
      hideInlet: true,
      description: 'Delay line name',
      defaultValue: 'delay',
      messages: [{ schema: Type.String(), description: 'Set delay line name' }]
    },
    {
      name: 'delay',
      type: 'float',
      description: 'Delay time in ms',
      defaultValue: 0,
      minNumber: 0,
      precision: 0,
      messages: [{ schema: Type.Number(), description: 'Delay time in milliseconds' }]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Delayed signal output' }],

  tags: ['audio', 'delay', 'buffer', 'read', 'effect']
});
