import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/tabread.processor?worker&url';

export const TabreadNode = createWorkletDspNode({
  type: 'tabread~',
  group: 'processors',
  description: 'Read from a named buffer using an index signal',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [
    {
      name: 'index',
      type: 'signal',
      description: 'Index signal (0 to buffer length)'
    },
    {
      name: 'name',
      type: 'string',
      description: 'Buffer name',
      messages: [{ schema: Type.String(), description: 'Set buffer name' }]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Signal read from buffer' }],

  tags: ['audio', 'buffer', 'table', 'read', 'playback']
});
