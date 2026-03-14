import { Type } from '@sinclair/typebox';
import { msg } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';

export const NoteOn = msg('noteOn', { note: Type.Number(), velocity: Type.Number() });
export const NoteOff = msg('noteOff', { note: Type.Number(), velocity: Type.Number() });

/** Load a sample into a specific pad slot: { type: 'load', pad: 0, src: 'user://Samples/kick.wav' } */
export const LoadPad = msg('load', { pad: Type.Number(), src: Type.String() });

export const padsMessages = {
  noteOn: schema(NoteOn),
  noteOff: schema(NoteOff),
  loadPad: schema(LoadPad)
};
