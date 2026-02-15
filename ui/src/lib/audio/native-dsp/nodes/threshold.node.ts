import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/threshold.processor?worker&url';

export const ThresholdNode = createWorkletDspNode({
  type: 'threshold~',
  group: 'processors',
  description: 'Trigger bangs from audio signal level',

  workletUrl,

  audioInlets: 1,
  audioOutlets: 0,

  inlets: [
    {
      name: 'signal',
      type: 'signal',
      description: 'Signal to analyze'
    },
    {
      name: 'message',
      type: 'message',
      description: 'Set thresholds and debounce, or set internal state',
      messages: [
        {
          schema: Type.Array(Type.Number(), { minItems: 1, maxItems: 4 }),
          description: 'Set [triggerThreshold, triggerDebounce, restThreshold, restDebounce] (ms)'
        },
        {
          schema: Type.Number(),
          description: 'Nonzero sets state to high, zero sets to low'
        }
      ]
    }
  ],

  outlets: [
    { name: 'trigger', type: 'bang', description: 'Bang when signal reaches trigger threshold' },
    { name: 'rest', type: 'bang', description: 'Bang when signal drops below rest threshold' }
  ],

  tags: ['audio', 'trigger', 'threshold', 'signal', 'detect', 'onset']
});
