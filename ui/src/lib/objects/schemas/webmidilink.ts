import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the webmidilink object.
 */
export const webmidilinkSchema: ObjectSchema = {
  type: 'webmidilink',
  category: 'control',
  description: 'Converts MIDI events to WebMidiLink format',
  inlets: [
    {
      id: 'midi',
      description: 'MIDI event input',
      messages: [
        {
          schema: Type.Object({
            type: Type.Union([
              Type.Literal('noteOn'),
              Type.Literal('noteOff'),
              Type.Literal('controlChange'),
              Type.Literal('programChange'),
              Type.Literal('pitchBend')
            ]),
            note: Type.Optional(Type.Number()),
            velocity: Type.Optional(Type.Number()),
            control: Type.Optional(Type.Number()),
            value: Type.Optional(Type.Number()),
            program: Type.Optional(Type.Number()),
            channel: Type.Optional(Type.Number())
          }),
          description: 'MIDI event (noteOn, noteOff, controlChange, programChange, pitchBend)'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'out',
      description: 'WebMidiLink formatted message (midi,XX,XX,XX)'
    }
  ],
  tags: ['control', 'midi', 'webmidilink', 'protocol']
};
