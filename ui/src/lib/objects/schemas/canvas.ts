import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, messages } from './common';

// Canvas-specific message schemas
const SetCode = msg('setCode', { code: Type.String() });
const Run = sym('run');

/** Pre-wrapped matchers for use with ts-pattern */
export const canvasMessages = {
  ...messages,
  setCode: schema(SetCode),
  run: schema(Run)
};

/**
 * Schema for the canvas (offscreen JavaScript canvas) object.
 */
export const canvasSchema: ObjectSchema = {
  type: 'canvas',
  category: 'video',
  description: 'Creates an offscreen JavaScript canvas for graphics',
  inlets: [],
  outlets: [],
  tags: ['graphics', 'drawing', 'animation', 'html5', '2d', 'offscreen'],
  hasDynamicOutlets: true
};

/**
 * Schema for the canvas.dom (main thread JavaScript canvas) object.
 */
export const canvasDomSchema: ObjectSchema = {
  type: 'canvas.dom',
  category: 'video',
  description: 'Creates a JavaScript canvas on main thread with DOM access',
  inlets: [],
  outlets: [],
  tags: ['graphics', 'drawing', 'animation', 'html5', '2d', 'interactive', 'mouse', 'keyboard'],
  hasDynamicOutlets: true
};
