import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/tabread4.processor?worker&url';

export const Tabread4Node = createWorkletDspNode({
  type: 'tabread4~',
  group: 'processors',
  description: 'Read from a named buffer with 4-point interpolation',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 1,

  inlets: [
    {
      name: 'index',
      type: 'signal',
      description: 'Index signal (0 to buffer length, fractional for interpolation)'
    },
    {
      name: 'name',
      type: 'message',
      description: 'Buffer name',
      messages: [{ schema: Type.String(), description: 'Set buffer name' }]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Interpolated signal read from buffer' }],

  tags: ['audio', 'buffer', 'table', 'read', 'interpolation', 'playback']
});
