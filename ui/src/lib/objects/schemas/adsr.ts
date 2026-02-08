import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the adsr (ADSR envelope generator) object.
 */
export const adsrSchema: ObjectSchema = {
  type: 'adsr',
  category: 'control',
  description: 'ADSR envelope generator for controlling audio parameters',
  inlets: [
    {
      id: 'trigger',
      description: 'Envelope trigger',
      messages: [
        { schema: Type.Literal(1), description: 'Trigger attack→decay→sustain' },
        { schema: Type.Literal(0), description: 'Trigger release' }
      ]
    },
    {
      id: 'peak',
      description: 'Peak amplitude',
      messages: [{ schema: Type.Number(), description: 'Peak level (default: 1)' }]
    },
    {
      id: 'attack',
      description: 'Attack time',
      messages: [{ schema: Type.Number(), description: 'Attack time in ms (default: 100)' }]
    },
    {
      id: 'decay',
      description: 'Decay time',
      messages: [{ schema: Type.Number(), description: 'Decay time in ms (default: 200)' }]
    },
    {
      id: 'sustain',
      description: 'Sustain level',
      messages: [{ schema: Type.Number(), description: 'Sustain level (default: 0.5)' }]
    },
    {
      id: 'release',
      description: 'Release time',
      messages: [{ schema: Type.Number(), description: 'Release time in ms (default: 300)' }]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Envelope output',
      messages: [{ schema: Type.Any(), description: 'Scheduled parameter messages' }]
    }
  ],
  tags: ['control', 'envelope', 'adsr', 'automation']
};
