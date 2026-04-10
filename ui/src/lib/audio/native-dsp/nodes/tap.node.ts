import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/tap.processor?worker&url';

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
