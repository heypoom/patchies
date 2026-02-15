import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/vline.processor?worker&url';

export const VlineNode = createWorkletDspNode({
  type: 'vline~',
  group: 'processors',
  description: 'Sample-accurate scheduled ramps',

  workletUrl,

  audioInlets: 0,
  audioOutlets: 1,

  inlets: [
    {
      name: 'target',
      type: 'message',
      description: 'Target value or [target, time] or [target, time, delay]',
      hot: true,
      messages: [
        { schema: Type.Number(), description: 'Jump to value immediately' },
        {
          schema: Type.Tuple([Type.Number(), Type.Number()]),
          description: 'Ramp to [target, time_ms]'
        },
        {
          schema: Type.Tuple([Type.Number(), Type.Number(), Type.Number()]),
          description: 'Ramp to [target, time_ms, delay_ms]'
        }
      ]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Ramped signal output' }],

  tags: ['audio', 'ramp', 'envelope', 'signal', 'vline', 'schedule']
});
