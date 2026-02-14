import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/phasor.processor?worker&url';

export const PhasorNode = createWorkletDspNode({
  type: 'phasor~',
  group: 'sources',
  description: 'Sawtooth ramp oscillator (0 to 1)',

  workletUrl,

  audioInlets: 0,
  audioOutlets: 1,

  inlets: [
    {
      name: 'frequency',
      type: 'float',
      description: 'Frequency in Hz',
      defaultValue: 0,
      maxPrecision: 2,
      messages: [{ schema: Type.Number(), description: 'Frequency in Hz' }]
    }
  ],

  outlets: [
    {
      name: 'out',
      type: 'signal',
      description: 'Ramp output (0 to 1)'
    }
  ],

  tags: ['audio', 'oscillator', 'ramp', 'phasor', 'signal']
});
