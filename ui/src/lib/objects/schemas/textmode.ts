import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, messages } from './common';

// Textmode-specific message schemas
const SetCode = msg('setCode', { code: Type.String() });
const Run = sym('run');

/** Pre-wrapped matchers for use with ts-pattern */
export const textmodeMessages = {
  ...messages,
  setCode: schema(SetCode),
  run: schema(Run)
};

/**
 * Schema for the textmode (offscreen ASCII graphics) object.
 */
export const textmodeSchema: ObjectSchema = {
  type: 'textmode',
  category: 'video',
  description: 'Creates ASCII/text-mode graphics using textmode.js',
  inlets: [],
  outlets: [],
  tags: ['ascii', 'text', 'retro', 'characters', 'webgl'],
  hasDynamicOutlets: true
};

/**
 * Schema for the textmode.dom (main thread ASCII graphics) object.
 */
export const textmodeDomSchema: ObjectSchema = {
  type: 'textmode.dom',
  category: 'video',
  description: 'Creates ASCII/text-mode graphics with mouse/keyboard support',
  inlets: [],
  outlets: [],
  tags: ['ascii', 'text', 'retro', 'characters', 'webgl', 'interactive'],
  hasDynamicOutlets: true
};
