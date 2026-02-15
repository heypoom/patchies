import { Type } from '@sinclair/typebox';
import { createWorkletDspNode } from '../create-worklet-dsp-node';
import workletUrl from '../processors/adsr.processor?worker&url';
import { sym } from '$lib/objects/schemas/helpers';

export const AdsrNode = createWorkletDspNode({
  type: 'adsr~',
  group: 'processors',
  description: 'Sample-accurate ADSR envelope generator',

  workletUrl,

  audioInlets: 0,
  audioOutlets: 1,

  inlets: [
    {
      name: 'trigger',
      type: 'message',
      description: 'Gate on (1) / off (0)',
      hot: true,
      messages: [
        { schema: Type.Number(), description: 'Gate: 1 = on (attack), 0 = off (release)' },
        { schema: sym('bang'), description: 'Trigger attack' }
      ]
    },
    {
      name: 'attack',
      type: 'float',
      description: 'Attack time in ms',
      defaultValue: 10,
      minNumber: 1,
      precision: 0,
      messages: [{ schema: Type.Number(), description: 'Attack time in milliseconds' }]
    },
    {
      name: 'decay',
      type: 'float',
      description: 'Decay time in ms',
      defaultValue: 100,
      minNumber: 1,
      precision: 0,
      messages: [{ schema: Type.Number(), description: 'Decay time in milliseconds' }]
    },
    {
      name: 'sustain',
      type: 'float',
      description: 'Sustain level (0-1)',
      defaultValue: 0.5,
      minNumber: 0,
      maxNumber: 1,
      maxPrecision: 2,
      messages: [{ schema: Type.Number(), description: 'Sustain level (0-1)' }]
    },
    {
      name: 'release',
      type: 'float',
      description: 'Release time in ms',
      defaultValue: 300,
      minNumber: 1,
      precision: 0,
      messages: [{ schema: Type.Number(), description: 'Release time in milliseconds' }]
    }
  ],

  outlets: [{ name: 'out', type: 'signal', description: 'Envelope signal (0-1)' }],

  tags: ['audio', 'envelope', 'adsr', 'gate', 'signal']
});
