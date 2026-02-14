import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/line.processor?worker&url';
import { sym } from '$lib/objects/schemas/helpers';

export const LineNode = createWorkletDspNode({
  type: 'line~',
  group: 'processors',
  description: 'Signal ramp generator',

  workletUrl,

  audioInlets: 0,
  audioOutlets: 1,

  inlets: [
    {
      name: 'target',
      type: 'message',
      description: 'Target value (or [value, time] pair)',
      hot: true,
      messages: [
        { schema: Type.Number(), description: 'Jump to value immediately' },
        {
          schema: Type.Tuple([Type.Number(), Type.Number()]),
          description: 'Ramp to [target, time_ms]'
        },
        { schema: sym('stop'), description: 'Stop current ramp' }
      ]
    },
    {
      name: 'time',
      type: 'float',
      description: 'Ramp time in ms (used by next target)',
      defaultValue: 0,
      minNumber: 0,
      precision: 0,
      messages: [{ schema: Type.Number(), description: 'Ramp duration in milliseconds' }],
      hideTextParam: true
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Ramped signal output' }],

  tags: ['audio', 'ramp', 'envelope', 'signal', 'line']
});
