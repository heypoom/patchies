import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/tap.processor?worker&url';
import { Type } from '@sinclair/typebox';

const SetMode = Type.Object({ mode: Type.Union([Type.Literal('waveform'), Type.Literal('xy')]) });
const SetBufferSize = Type.Object({ bufferSize: Type.Number() });
const SetFps = Type.Object({ fps: Type.Number() });

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
      name: 'settings',
      type: 'message',
      description: 'Control messages for mode, bufferSize, and fps',
      messages: [
        { schema: SetMode, description: 'Set capture mode: waveform or xy' },
        { schema: SetBufferSize, description: 'Set buffer size (64–2048)' },
        { schema: SetFps, description: 'Set max refresh rate in fps (0 = unlimited)' }
      ]
    }
  ],

  outlets: [
    {
      name: 'out',
      type: 'message',
      description:
        'Captured buffer: Float32Array (waveform) or { x, y: Float32Array } (XY mode). Trigger-synced on rising zero-crossing.'
    }
  ],

  tags: ['audio', 'scope', 'waveform', 'oscilloscope', 'capture', 'tap', 'signal', 'analysis']
});
