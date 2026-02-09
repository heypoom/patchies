import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, messages } from './common';

// GLSL-specific message schemas
const SetCode = msg('setCode', { code: Type.String() });
const Run = sym('run');

/** Pre-wrapped matchers for use with ts-pattern */
export const glslMessages = {
  ...messages,
  setCode: schema(SetCode),
  run: schema(Run)
};

/**
 * Schema for the glsl (GLSL fragment shader) object.
 */
export const glslSchema: ObjectSchema = {
  type: 'glsl',
  category: 'video',
  description: 'Creates a GLSL fragment shader for visual effects',
  inlets: [],
  outlets: [],
  tags: ['shader', 'visual', 'graphics', 'opengl', 'gpu', 'shadertoy'],
  hasDynamicOutlets: true
};
