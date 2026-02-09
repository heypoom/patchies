import { Type } from '@sinclair/typebox';
import { schema } from './types';
import { sym, msg } from './helpers';

/**
 * Common message schemas used across many objects.
 * These are the standard Patchies message types.
 */

// Raw TypeBox schemas
export const Bang = sym('bang');
export const SetCode = msg('setCode', { value: Type.String() });
export const Clear = sym('clear');
export const Reset = sym('reset');
export const Start = sym('start');
export const Stop = sym('stop');
export const Pause = sym('pause');
export const Play = sym('play');
export const Run = sym('run');
export const Toggle = sym('toggle');

/**
 * Pre-wrapped matchers for use with ts-pattern.
 * Usage: match(msg).with(messages.bang, () => ...)
 */
export const messages = {
  bang: schema(Bang),
  setCode: schema(SetCode),
  clear: schema(Clear),
  reset: schema(Reset),
  start: schema(Start),
  stop: schema(Stop),
  pause: schema(Pause),
  play: schema(Play),
  run: schema(Run),
  toggle: schema(Toggle)
};
