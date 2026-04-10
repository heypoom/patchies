import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/tap.processor?worker&url';
import { Type } from '@sinclair/typebox';

export const TapNode = createWorkletDspNode({
  type: 'tap~',
  group: 'processors',
  description: 'Capture audio frames and forward as messages',

  workletUrl,

  audioInlets: 2,
  audioOutlets: 0,

  inlets: [
    {
      name: 'in',
      type: 'signal',
      description: 'Audio signal (or X axis in XY mode)'
    },
    {
      name: 'y',
      type: 'signal',
      description: 'Y axis signal (XY mode only)'
    },
    {
      name: 'bufferSize',
      type: 'int',
      description: 'Number of samples captured per frame',
      defaultValue: 512,
      minNumber: 64,
      maxNumber: 2048
    },
    {
      name: 'mode',
      type: 'string',
      description: 'Capture mode',
      defaultValue: 'wave',
      options: ['wave', 'xy']
    },
    {
      name: 'fps',
      type: 'float',
      description: 'Max refresh rate in fps (0 = unlimited)',
      defaultValue: 0,
      minNumber: 0,
      maxNumber: 120
    }
  ],

  outlets: [
    {
      name: 'out',
      type: 'message',
      description: 'Captured buffer, trigger-synced on rising zero-crossing.',
      messages: [
        {
          schema: Type.Unsafe<Float32Array>({ type: 'Float32Array' }),
          description: 'Wave Mode'
        },
        {
          schema: Type.Object({
            type: Type.Literal('xy'),
            x: Type.Unsafe<Float32Array>({ type: 'Float32Array' }),
            y: Type.Unsafe<Float32Array>({ type: 'Float32Array' })
          }),
          description: 'XY Mode'
        }
      ]
    }
  ],

  tags: ['audio', 'scope', 'waveform', 'oscilloscope', 'capture', 'tap', 'signal', 'analysis']
});
