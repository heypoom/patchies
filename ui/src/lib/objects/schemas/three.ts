import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, messages } from './common';

// Three.js-specific message schemas
const SetCode = msg('setCode', { code: Type.String() });
const Run = sym('run');

/** Pre-wrapped matchers for use with ts-pattern */
export const threeMessages = {
  ...messages,
  setCode: schema(SetCode),
  run: schema(Run)
};

/**
 * Schema for the three (offscreen Three.js) object.
 */
export const threeSchema: ObjectSchema = {
  type: 'three',
  category: 'video',
  description: 'Creates Three.js 3D graphics on web worker',
  inlets: [],
  outlets: [],
  tags: ['3d', 'webgl', 'graphics', 'animation', 'scene'],
  hasDynamicOutlets: true
};

/**
 * Schema for the three.dom (main thread Three.js) object.
 */
export const threeDomSchema: ObjectSchema = {
  type: 'three.dom',
  category: 'video',
  description: 'Creates Three.js 3D graphics with interactivity',
  inlets: [],
  outlets: [],
  tags: ['3d', 'webgl', 'graphics', 'animation', 'scene', 'interactive'],
  hasDynamicOutlets: true
};
