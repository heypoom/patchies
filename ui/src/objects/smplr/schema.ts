import { Type } from '@sinclair/typebox';

import { Stop } from '$lib/objects/schemas/common';
import { msg } from '$lib/objects/schemas/helpers';
import { MidiControlChange, MidiProgramChange } from '$lib/objects/schemas/midi-messages';
import type { ObjectSchema } from '$lib/objects/schemas/types';

import { smplrDescriptors, type SmplrObjectType } from './descriptors';

const Note = Type.Union([Type.Number(), Type.String()]);

const BangTrigger = msg('bang', {
  time: Type.Optional(Type.Number()),
  value: Type.Optional(Type.Number({ minimum: 0 })),
  offset: Type.Optional(Type.Number()),
  duration: Type.Optional(Type.Number())
});

const NoteOn = msg('noteOn', {
  note: Note,
  velocity: Type.Number(),
  time: Type.Optional(Type.Number()),
  duration: Type.Optional(Type.Number()),
  channel: Type.Optional(Type.Number())
});

const NoteOff = msg('noteOff', {
  note: Note,
  velocity: Type.Optional(Type.Number()),
  time: Type.Optional(Type.Number()),
  channel: Type.Optional(Type.Number())
});

const SetGain = msg('setGain', {
  value: Type.Number({ minimum: 0, maximum: 127 })
});

const SetDetune = msg('setDetune', {
  value: Type.Number()
});

const SetReverse = msg('setReverse', {
  value: Type.Boolean()
});

function createSmplrSchema(type: SmplrObjectType): ObjectSchema {
  const descriptor = smplrDescriptors[type];

  return {
    type,
    category: 'audio',
    description: descriptor.description,
    inlets: [
      {
        id: 'message',
        description: 'MIDI and trigger messages',
        handle: { handleType: 'message' },
        messages: [
          {
            schema: BangTrigger,
            description:
              'Trigger the configured default note with optional scheduled time, value, offset, and duration'
          },
          {
            schema: Type.Number({ minimum: 0 }),
            description: 'Trigger the configured default note with a gain multiplier'
          },
          {
            schema: NoteOn,
            description: 'Start a note by MIDI number or instrument-specific note name'
          },
          {
            schema: NoteOff,
            description: 'Stop a note by MIDI number or instrument-specific note name'
          },
          {
            schema: MidiControlChange,
            description: 'Forward a MIDI control-change message to the smplr instrument'
          },
          {
            schema: MidiProgramChange,
            description: 'Change instrument program when this smplr family supports it'
          },
          {
            schema: SetGain,
            description: 'Set output volume for the instrument'
          },
          {
            schema: SetDetune,
            description: 'Set pitch detune in cents'
          },
          {
            schema: SetReverse,
            description: 'Enable or disable reversed sample playback'
          },
          {
            schema: Stop,
            description: 'Stop active voices'
          }
        ]
      }
    ],
    outlets: [
      {
        id: 'out',
        type: 'signal',
        description: 'Instrument audio output',
        handle: { handleType: 'audio' }
      }
    ],
    tags: ['audio', 'midi', 'sample', 'instrument', 'smplr']
  };
}

export const soundfontSchema = createSmplrSchema('soundfont~');
export const soundfont2Schema = createSmplrSchema('soundfont2~');
export const pianoSchema = createSmplrSchema('piano~');
export const epianoSchema = createSmplrSchema('epiano~');
export const drumMachineSchema = createSmplrSchema('drum-machine~');
export const malletSchema = createSmplrSchema('mallet~');
export const mellotronSchema = createSmplrSchema('mellotron~');
export const versilianSchema = createSmplrSchema('versilian~');
export const smolkenSchema = createSmplrSchema('smolken~');
