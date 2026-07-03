import { Type } from '@sinclair/typebox';
import { Bang, Pause, Play, Stop } from '$lib/objects/schemas/common';
import {
  MidiChannelPressure,
  MidiControlChange,
  MidiNoteOff,
  MidiNoteOn,
  MidiPitchBend,
  MidiPolyPressure,
  MidiProgramChange
} from '$lib/objects/schemas/midi-messages';
import type { ObjectSchema } from '$lib/objects/schemas/types';

const Seek = Type.Object({
  type: Type.Literal('seek'),
  seconds: Type.Optional(Type.Number()),
  beats: Type.Optional(Type.Number()),
  ticks: Type.Optional(Type.Number())
});

const Loop = Type.Object({
  type: Type.Literal('loop'),
  value: Type.Optional(Type.Boolean())
});

const Events = Type.Object({
  type: Type.Literal('events')
});

const SetMidiFileConfig = Type.Object({
  type: Type.Literal('set'),
  applyTempoToTransport: Type.Optional(Type.Boolean()),
  applyTimeSignatureToTransport: Type.Optional(Type.Boolean()),
  syncTransport: Type.Optional(Type.Boolean()),
  outputMetaEvents: Type.Optional(Type.Boolean()),
  sendPositionEvents: Type.Optional(Type.Boolean()),
  loop: Type.Optional(Type.Boolean())
});

const Loaded = Type.Object({
  type: Type.Literal('loaded'),
  fileName: Type.String(),
  durationSeconds: Type.Number(),
  trackCount: Type.Number(),
  ppq: Type.Number(),
  programs: Type.Array(
    Type.Object({
      channel: Type.Number(),
      program: Type.Number()
    })
  ),
  preloadPrograms: Type.Array(
    Type.Object({
      channel: Type.Number(),
      program: Type.Number()
    })
  )
});

const Position = Type.Object({
  type: Type.Literal('position'),
  seconds: Type.Number(),
  progress: Type.Number()
});

const Ended = Type.Object({
  type: Type.Literal('ended')
});

const Tempo = Type.Object({
  type: Type.Literal('tempo'),
  bpm: Type.Number(),
  tick: Type.Number()
});

const TimeSignature = Type.Object({
  type: Type.Literal('timeSignature'),
  numerator: Type.Number(),
  denominator: Type.Number(),
  tick: Type.Number()
});

const KeySignature = Type.Object({
  type: Type.Literal('keySignature'),
  key: Type.String(),
  tick: Type.Number()
});

const TrackName = Type.Object({
  type: Type.Literal('trackName'),
  name: Type.String(),
  track: Type.Number()
});

const ErrorMessage = Type.Object({
  type: Type.Literal('error'),
  message: Type.String()
});

export const midiFileSchema: ObjectSchema = {
  type: 'midi.file',
  category: 'network',
  description: 'Play MIDI files as Patchies MIDI messages',
  inlets: [
    {
      id: 'command',
      description: 'Playback, seek, load, and settings commands',
      handle: { handleType: 'message' },
      messages: [
        { schema: Bang, description: 'Start playback from the current position' },
        { schema: Play, description: 'Start playback from the current position' },
        { schema: Pause, description: 'Pause playback and hold the current position' },
        { schema: Stop, description: 'Stop playback, reset position, and flush active notes' },
        { schema: Seek, description: 'Seek by seconds, beats, or ticks' },
        { schema: Loop, description: 'Toggle or set looping' },
        { schema: Events, description: 'Send all scheduled MIDI and meta events as an array' },
        { schema: SetMidiFileConfig, description: 'Update playback and transport settings' },
        { schema: Type.String(), description: 'Load a MIDI file from an http(s) URL or VFS path' },
        { schema: Type.Array(Type.Number()), description: 'Load raw MIDI bytes' },
        { schema: Type.Any(), description: 'Load MIDI bytes from an ArrayBuffer or typed array' }
      ]
    }
  ],
  outlets: [
    {
      id: 'out',
      description: 'MIDI channel messages and playback/meta status',
      handle: { handleType: 'message' },
      messages: [
        { schema: MidiNoteOn, description: 'MIDI note on' },
        { schema: MidiNoteOff, description: 'MIDI note off' },
        { schema: MidiControlChange, description: 'MIDI control change' },
        { schema: MidiProgramChange, description: 'MIDI program change' },
        { schema: MidiPitchBend, description: 'MIDI pitch bend' },
        { schema: MidiChannelPressure, description: 'MIDI channel pressure' },
        { schema: MidiPolyPressure, description: 'MIDI poly pressure' },
        { schema: Loaded, description: 'Sent when a MIDI file loads' },
        { schema: Position, description: 'Playback position status' },
        { schema: Ended, description: 'Sent when playback reaches the end' },
        { schema: Tempo, description: 'MIDI tempo meta event' },
        { schema: TimeSignature, description: 'MIDI time signature meta event' },
        { schema: KeySignature, description: 'MIDI key signature meta event' },
        { schema: TrackName, description: 'MIDI track name meta event' },
        { schema: ErrorMessage, description: 'Load or playback error' }
      ]
    }
  ],
  tags: ['midi', 'file', 'sequencer', 'music']
};
