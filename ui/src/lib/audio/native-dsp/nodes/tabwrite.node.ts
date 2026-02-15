import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/tabwrite.processor?worker&url';
import { sym } from '$lib/objects/schemas/helpers';

export const TabwriteNode = createWorkletDspNode({
  type: 'tabwrite~',
  group: 'processors',
  description: 'Write audio signal into a named buffer',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 0,

  inlets: [
    {
      name: 'signal',
      type: 'signal',
      description: 'Audio signal to write into the buffer'
    },
    {
      name: 'control',
      type: 'string',
      description: 'Buffer name and control commands',
      messages: [
        { schema: Type.String(), description: 'Set buffer name' },
        { schema: sym('bang'), description: 'Reset write head to 0' },
        { schema: sym('stop'), description: 'Stop writing' },
        { schema: sym('start'), description: 'Resume writing' }
      ]
    }
  ],

  outlets: [],

  tags: ['audio', 'buffer', 'table', 'write', 'record']
});
