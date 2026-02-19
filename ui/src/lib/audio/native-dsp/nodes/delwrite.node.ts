import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import { sym } from '$lib/objects/schemas/helpers';
import workletUrl from '../processors/delwrite.processor?worker&url';

export const DelwriteNode = createWorkletDspNode({
  type: 'delwrite~',
  group: 'processors',
  description: 'Write to a named delay line',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 0,

  inlets: [
    {
      name: 'signal',
      type: 'signal',
      description: 'Audio input to write to delay line'
    },
    {
      name: 'control',
      type: 'message',
      description: 'Control messages',
      messages: [
        {
          schema: sym('clear'),
          description: 'Clear the delay line (fill with zeros)'
        }
      ]
    },
    {
      name: 'name',
      type: 'string',
      hideInlet: true,
      description: 'Delay line name',
      defaultValue: 'delay',
      messages: [{ schema: Type.String(), description: 'Set delay line name' }]
    },
    {
      name: 'size',
      type: 'float',
      hideInlet: true,
      description: 'Delay line size in ms',
      defaultValue: 1000,
      minNumber: 1,
      maxNumber: 60000,
      precision: 0,
      messages: [{ schema: Type.Number(), description: 'Size in milliseconds' }]
    }
  ],

  outlets: [],

  tags: ['audio', 'delay', 'buffer', 'write', 'effect']
});
