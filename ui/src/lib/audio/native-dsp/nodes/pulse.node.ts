import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/pulse.processor?worker&url';

export const PulseNode = createWorkletDspNode({
  type: 'pulse~',
  group: 'sources',
  description: 'Pulse wave oscillator with PWM',

  workletUrl,

  audioInlets: 0,
  audioOutlets: 1,

  inlets: [
    {
      name: 'frequency',
      type: 'float',
      description: 'Frequency in Hz',
      defaultValue: 440,
      minNumber: 0,
      precision: 1,
      messages: [{ schema: Type.Number(), description: 'Frequency in Hz' }]
    },
    {
      name: 'width',
      type: 'float',
      description: 'Pulse width (0-1)',
      defaultValue: 0.5,
      minNumber: 0,
      maxNumber: 1,
      maxPrecision: 2,
      messages: [
        { schema: Type.Number(), description: 'Pulse width (0 = silent, 0.5 = square, 1 = silent)' }
      ]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Pulse wave signal' }],

  tags: ['audio', 'oscillator', 'pulse', 'square', 'pwm', 'generator', 'source']
});
