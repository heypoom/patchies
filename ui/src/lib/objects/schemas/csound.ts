import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, Play, Pause, Stop, Reset, messages } from './common';

// Csound-specific message schemas
const Resume = sym('resume');
const SetChannel = msg('setChannel', {
  channel: Type.String(),
  value: Type.Union([Type.Number(), Type.String()])
});
const SetOptions = msg('setOptions', { value: Type.String() });
const NoteOn = msg('noteOn', { note: Type.Number(), velocity: Type.Number() });
const NoteOff = msg('noteOff', { note: Type.Number(), velocity: Type.Optional(Type.Number()) });
const ReadScore = msg('readScore', { value: Type.String() });
const Eval = msg('eval', { code: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const csoundMessages = {
  ...messages,
  resume: schema(Resume),
  setChannel: schema(SetChannel),
  setOptions: schema(SetOptions),
  noteOn: schema(NoteOn),
  noteOff: schema(NoteOff),
  readScore: schema(ReadScore),
  eval: schema(Eval)
};

/**
 * Schema for the csound~ (Csound audio) object.
 */
export const csoundSchema: ObjectSchema = {
  type: 'csound~',
  category: 'audio',
  description: 'Csound audio programming language for synthesis and processing',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Bang, description: 'Resume or re-eval Csound code' },
        { schema: Play, description: 'Resume playback' },
        { schema: Pause, description: 'Pause playback' },
        { schema: Stop, description: 'Stop playback' },
        { schema: Reset, description: 'Reset the Csound instance' },
        { schema: SetChannel, description: 'Set a control or string channel value' },
        { schema: SetOptions, description: 'Set Csound options and reset' },
        { schema: NoteOn, description: 'Send MIDI note on' },
        { schema: NoteOff, description: 'Send MIDI note off' },
        { schema: ReadScore, description: 'Send score statements to Csound' },
        { schema: Eval, description: 'Evaluate Csound code' },
        { schema: Type.Number(), description: 'Set control channel for inlet index' },
        { schema: Type.String(), description: 'Send input message or set option' }
      ]
    }
  ],
  outlets: [],
  tags: ['audio', 'csound', 'synthesis', 'programming', 'dsp'],
  hasDynamicOutlets: true
};
