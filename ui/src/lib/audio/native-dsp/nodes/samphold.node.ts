import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/samphold.processor?worker&url';
import { msg, sym } from '$lib/objects/schemas/helpers';

export const SampholdNode = createWorkletDspNode({
  type: 'samphold~',
  group: 'processors',
  description: 'Sample and hold unit',

  workletUrl,

  audioInlets: 2,
  audioOutlets: 1,

  inlets: [
    {
      name: 'signal',
      type: 'signal',
      description: 'Input signal to be sampled'
    },
    {
      name: 'control',
      type: 'signal',
      description: 'Control signal (samples when decreasing)'
    },
    {
      name: 'message',
      type: 'message',
      description: 'Set or reset commands',
      messages: [
        { schema: msg('set', { value: Type.Number() }), description: 'Set output value' },
        {
          schema: msg('reset', { value: Type.Number() }),
          description: 'Set last control value'
        },
        { schema: sym('reset'), description: 'Force next sample (reset to infinity)' }
      ]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Sampled and held signal' }],

  tags: ['audio', 'sample', 'hold', 'control', 'signal']
});
