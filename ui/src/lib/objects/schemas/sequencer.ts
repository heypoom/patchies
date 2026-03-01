import { Type } from '@sinclair/typebox';
import { type ObjectSchema, schema } from './types';
import { msg, sym } from './helpers';
import { Bang, Clear, Reset, messages } from './common';

// --- Manual clock: manually move to a step ---
const Goto = msg('goto', { step: Type.Number() });

// --- Step control ---
const SetStep = msg('setStep', {
  track: Type.Number(),
  step: Type.Number(),
  on: Type.Boolean()
});

// Batch velocity must come before single-step so ts-pattern matches it first
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

// --- Pattern manipulation ---
// Specific (with track) must come before general (without) in ts-pattern match chains
const ClearTrack = msg('clear', { track: Type.Number() });
const FillAll = sym('fill');
const FillTrack = msg('fill', { track: Type.Number() });
const RandomAll = sym('random');
const Rotate = msg('rotate', { track: Type.Number(), amount: Type.Number() });

// --- Mute ---
const Mute = sym('mute');
const Unmute = sym('unmute');

// --- Config ---
const SetSwing = msg('setSwing', { value: Type.Number() });

const SetOutputMode = msg('setOutputMode', {
  value: Type.Union([Type.Literal('bang'), Type.Literal('value'), Type.Literal('audio')])
});

const SetClockMode = msg('setClockMode', {
  value: Type.Union([Type.Literal('auto'), Type.Literal('manual')])
});

const SetStepCount = msg('setStepCount', { value: Type.Number() });

// --- Output (for outlet schema doc) ---
const SetSchedule = msg('set', {
  time: Type.Number(),
  value: Type.Number({ minimum: 0, maximum: 1 })
});

/**
 * Pre-wrapped matchers for use with ts-pattern.
 *
 * Ordering matters for messages sharing the same `type`:
 * - setVelocityAll before setVelocityOne (both have type:'setVelocity')
 * - clearTrack before messages.clear (both have type:'clear')
 * - fillTrack before fillAll (both have type:'fill')
 */
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
  setClockMode: schema(SetClockMode),
  setStepCount: schema(SetStepCount)
};

/**
 * Schema for the sequencer (step sequencer) object.
 */
export const sequencerSchema: ObjectSchema = {
  type: 'sequencer',
  category: 'control',
  description:
    'DAW-style step sequencer with up to 8 tracks. Runs synced to the transport or advances one step per bang.',
  inlets: [
    {
      id: 'message',
      description: 'Control inlet',
      messages: [
        // Mute
        { schema: Mute, description: 'Silence all output (scheduler keeps running)' },
        { schema: Unmute, description: 'Restore output after mute' },

        // Configuration
        { schema: SetSwing, description: 'Set swing amount (0–100)' },
        { schema: SetOutputMode, description: 'Set output mode (bang / value / audio)' },
        { schema: SetClockMode, description: 'Set clock mode (auto / manual)' },
        { schema: SetStepCount, description: 'Set number of steps (4, 8, 12, 16, 24, or 32)' },

        // Manual clock messages
        { schema: Bang, description: 'Advance one step (manual)' },
        { schema: Reset, description: 'Set step to 0 (manual)' },
        { schema: Goto, description: 'Jump to a step (manual)' },

        // Set pattern and velocity
        { schema: SetStep, description: 'Set a specific step on or off' },
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
        { schema: Clear, description: 'Clear all steps' },
        { schema: FillAll, description: 'Turn on all steps' },
        { schema: RandomAll, description: 'Randomize on/off and velocity' },
        { schema: ClearTrack, description: 'Clear all steps for a track' },
        { schema: FillTrack, description: 'Turn on all steps for a track' },
        {
          schema: Rotate,
          description:
            "Rotate a track's pattern by N steps (positive = right/later, negative = left/earlier)"
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'track',
      description:
        'Per-track trigger outlet (one outlet per track, numbered 0–7). Fires on each active step.',
      messages: [
        {
          schema: Bang,
          description: 'Fired on active step when output mode is "bang" (default)'
        },
        {
          schema: Type.Number({ minimum: 0, maximum: 1 }),
          description: 'Velocity value 0–1 when output mode is "value"'
        },
        {
          schema: SetSchedule,
          description:
            'Lookahead-scheduled audio event with precise Web Audio time and velocity, when output mode is "audio"'
        }
      ]
    }
  ],
  tags: ['sequencer', 'step', 'rhythm', 'transport', 'trigger', 'control', 'beat', 'drum']
};
