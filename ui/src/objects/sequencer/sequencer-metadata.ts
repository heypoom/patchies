import { Type } from '@sinclair/typebox';

import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { Bang, Clear, Reset, messages } from '$lib/objects/schemas/common';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';

import { SEQUENCER_STEP_COUNTS } from './sequencer-constants';

const FillAll = sym('fill');
const Mute = sym('mute');
const Unmute = sym('unmute');
const RandomAll = sym('random');

const Goto = msg('goto', {
  step: Type.Number()
});

const SetStep = msg('setStep', {
  track: Type.Number(),
  step: Type.Number(),
  on: Type.Boolean()
});

const SetVelocityAll = msg('setVelocity', {
  track: Type.Number(),
  values: Type.Array(Type.Number())
});

const SetVelocityOne = msg('setVelocity', {
  track: Type.Number(),
  step: Type.Number(),
  value: Type.Number()
});

const SetPattern = msg('setPattern', {
  track: Type.Number(),
  pattern: Type.Array(Type.Boolean())
});

const ClearTrack = msg('clear', {
  track: Type.Number()
});

const FillTrack = msg('fill', {
  track: Type.Number()
});

const Rotate = msg('rotate', {
  track: Type.Number(),
  amount: Type.Number()
});

const SetSwing = msg('setSwing', {
  value: Type.Number()
});

const SetOutputMode = msg('setOutputMode', {
  value: Type.Union([
    Type.Literal('bang'),
    Type.Literal('value'),
    Type.Literal('index'),
    Type.Literal('midi')
  ])
});

const SetAudioRate = msg('setAudioRate', {
  value: Type.Boolean()
});

const SetOutletMode = msg('setOutletMode', {
  value: Type.Union([Type.Literal('multi'), Type.Literal('single')])
});

const SetClockMode = msg('setClockMode', {
  value: Type.Union([Type.Literal('auto'), Type.Literal('manual')])
});

const SetStepCount = msg('setStepCount', {
  value: Type.Union(SEQUENCER_STEP_COUNTS.map((stepCount) => Type.Literal(stepCount)))
});

const BangOutput = msg('bang', {
  time: Type.Optional(Type.Number()),
  value: Type.Optional(
    Type.Number({
      minimum: 0,
      maximum: 1
    })
  ),
  index: Type.Optional(
    Type.Number({
      minimum: 0
    })
  )
});

const NoteOnOutput = msg('noteOn', {
  note: Type.Number(),
  index: Type.Number(),
  velocity: Type.Number({
    minimum: 0,
    maximum: 127
  }),
  time: Type.Optional(Type.Number())
});

export const sequencerMessages = {
  bang: messages.bang,
  reset: messages.reset,
  goto: schema(Goto),
  mute: schema(Mute),
  unmute: schema(Unmute),
  setStep: schema(SetStep),
  setVelocityAll: schema(SetVelocityAll),
  setVelocityOne: schema(SetVelocityOne),
  setPattern: schema(SetPattern),
  clearTrack: schema(ClearTrack),
  clearAll: messages.clear,
  fillTrack: schema(FillTrack),
  fillAll: schema(FillAll),
  randomAll: schema(RandomAll),
  rotate: schema(Rotate),
  setSwing: schema(SetSwing),
  setOutputMode: schema(SetOutputMode),
  setAudioRate: schema(SetAudioRate),
  setOutletMode: schema(SetOutletMode),
  setClockMode: schema(SetClockMode),
  setStepCount: schema(SetStepCount)
};

export const SEQUENCER_INLETS: ObjectInlet[] = [
  {
    name: 'message',
    type: 'message',
    description: 'Control inlet',
    handle: {
      handleType: 'message'
    },
    messages: [
      {
        schema: Mute,
        description: 'Silence all output'
      },
      {
        schema: Unmute,
        description: 'Restore output after mute'
      },
      {
        schema: SetSwing,
        description: 'Set swing amount (0–100)'
      },
      {
        schema: SetOutputMode,
        description: 'Set output mode (multi: bang/value, single: index/midi)'
      },
      {
        schema: SetAudioRate,
        description: 'Enable or disable audio lookahead timestamps on output'
      },
      {
        schema: SetOutletMode,
        description: 'Set outlet mode (multi = one outlet per track, single = one merged outlet)'
      },
      {
        schema: SetClockMode,
        description: 'Set clock mode (auto / manual)'
      },
      {
        schema: SetStepCount,
        description: 'Set number of steps (4, 8, 12, 16, 24, or 32)'
      },
      {
        schema: Bang,
        description: 'Advance one step (manual)'
      },
      {
        schema: Reset,
        description: 'Set step to 0 (manual)'
      },
      {
        schema: Goto,
        description: 'Jump to a step (manual)'
      },
      {
        schema: SetStep,
        description: 'Set a specific step on or off'
      },
      {
        schema: SetVelocityOne,
        description: 'Set velocity for a single step (0–1)'
      },
      {
        schema: SetVelocityAll,
        description: 'Set velocity for every step of a track'
      },
      {
        schema: SetPattern,
        description: 'Replace the on/off pattern for a track'
      },
      {
        schema: Clear,
        description: 'Clear all steps'
      },
      {
        schema: FillAll,
        description: 'Turn on all steps'
      },
      {
        schema: RandomAll,
        description: 'Randomize on/off and velocity'
      },
      {
        schema: ClearTrack,
        description: 'Clear all steps for a track'
      },
      {
        schema: FillTrack,
        description: 'Turn on all steps for a track'
      },
      {
        schema: Rotate,
        description:
          "Rotate a track's pattern by N steps (positive = right/later, negative = left/earlier)"
      }
    ]
  }
];

export const SEQUENCER_OUTLETS: ObjectOutlet[] = [
  {
    name: 'track',
    type: 'message',
    description:
      'Multi-outlet mode: per-track trigger outlet (one per track, numbered 0–7). Single-outlet mode: one merged outlet.',
    handle: { handleId: 0 },
    messages: [
      {
        schema: BangOutput,
        description:
          'Bang output. Audio lookahead adds time; value mode adds velocity; single/index mode also adds track index.'
      },
      {
        schema: Type.Number({ minimum: 0 }),
        description:
          'Number output: multi/value sends velocity 0–1; single/index sends track index.'
      },
      {
        schema: NoteOnOutput,
        description:
          'Single/midi output. Audio lookahead adds time; velocity is MIDI 0–127 and note follows the GM drum map.'
      }
    ]
  }
];
