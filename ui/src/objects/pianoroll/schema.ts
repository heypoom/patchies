import { Type } from '@sinclair/typebox';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { schema, type HandleSpec } from '$lib/objects/schemas/types';

export const NoteOn = msg('noteOn', {
  note: Type.Number(),
  velocity: Type.Number(),
  channel: Type.Optional(Type.Number())
});

export const NoteOff = msg('noteOff', {
  note: Type.Number(),
  velocity: Type.Optional(Type.Number()),
  channel: Type.Optional(Type.Number())
});

export const ArmCmd = sym('arm');
export const RecordCmd = sym('record');
export const StopCmd = sym('stop');
export const ClearCmd = sym('clear');
export const LoopCmd = sym('loop');
export const UnloopCmd = sym('unloop');

export const pianoRollHandles = {
  midiIn: { handleType: 'message', handleId: 'midi-in' } satisfies HandleSpec,
  commandIn: { handleType: 'message', handleId: 'command-in' } satisfies HandleSpec,
  midiOut: { handleType: 'message', handleId: 'midi-out' } satisfies HandleSpec
};

export const pianoRollMessages = {
  noteOn: schema(NoteOn),
  noteOff: schema(NoteOff),
  arm: schema(ArmCmd),
  record: schema(RecordCmd),
  stop: schema(StopCmd),
  clear: schema(ClearCmd),
  loop: schema(LoopCmd),
  unloop: schema(UnloopCmd)
};
