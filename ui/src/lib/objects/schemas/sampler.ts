import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, Stop, messages } from './common';

// Sampler-specific message schemas
const Play = sym('play');
const Record = sym('record');
const End = sym('end');
const Loop = sym('loop');
const LoopOn = sym('loopOn');
const LoopOff = sym('loopOff');
const LoopWithPoints = msg('loop', {
  start: Type.Number(),
  end: Type.Number()
});
const LoopWithOptionalPoints = msg('loop', {
  start: Type.Optional(Type.Number()),
  end: Type.Optional(Type.Number())
});
const LoopOnWithPoints = msg('loopOn', {
  start: Type.Number(),
  end: Type.Number()
});
const LoopOnWithOptionalPoints = msg('loopOn', {
  start: Type.Optional(Type.Number()),
  end: Type.Optional(Type.Number())
});
const SetStart = msg('setStart', { value: Type.Number() });
const SetEnd = msg('setEnd', { value: Type.Number() });
const SetPlaybackRate = msg('setPlaybackRate', { value: Type.Number() });
const SetDetune = msg('setDetune', { value: Type.Number() });

/** Pre-wrapped matchers for use with ts-pattern */
export const samplerMessages = {
  ...messages,
  play: schema(Play),
  record: schema(Record),
  end: schema(End),
  loop: schema(Loop),
  loopWithPoints: schema(LoopWithPoints),
  loopWithOptionalPoints: schema(LoopWithOptionalPoints),
  loopOn: schema(LoopOn),
  loopOnWithPoints: schema(LoopOnWithPoints),
  loopOnWithOptionalPoints: schema(LoopOnWithOptionalPoints),
  loopOff: schema(LoopOff),
  setStart: schema(SetStart),
  setEnd: schema(SetEnd),
  setPlaybackRate: schema(SetPlaybackRate),
  setDetune: schema(SetDetune)
};

/**
 * Schema for the sampler~ (audio sampler) object.
 */
export const samplerSchema: ObjectSchema = {
  type: 'sampler~',
  category: 'audio',
  description: 'Record and playback audio with loop points and pitch control',
  inlets: [
    {
      id: 'audio',
      description: 'Audio input for recording'
    },
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Bang, description: 'Play the recorded sample' },
        { schema: Play, description: 'Play the recorded sample' },
        { schema: Record, description: 'Start recording audio from connected sources' },
        { schema: End, description: 'Stop recording' },
        { schema: Stop, description: 'Stop playback' },
        { schema: Loop, description: 'Toggle loop and start loop playback' },
        { schema: LoopWithPoints, description: 'Set loop points (in seconds) and play' },
        { schema: LoopOn, description: 'Enable loop mode' },
        { schema: LoopOnWithPoints, description: 'Enable loop with specific points' },
        { schema: LoopOff, description: 'Disable loop mode' },
        { schema: SetStart, description: 'Set playback start position (seconds)' },
        { schema: SetEnd, description: 'Set playback end position (seconds)' },
        { schema: SetPlaybackRate, description: 'Set playback speed (1.0 = normal, 2.0 = double)' },
        { schema: SetDetune, description: 'Set pitch shift in cents (1200 = one octave)' }
      ]
    }
  ],
  outlets: [],
  tags: ['audio', 'sampler', 'recording', 'loop', 'pitch'],
  hasDynamicOutlets: true
};
