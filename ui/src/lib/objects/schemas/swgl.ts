import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, messages } from './common';

// SwissGL-specific message schemas
const SetCode = msg('setCode', { code: Type.String() });
const Run = sym('run');

/** Pre-wrapped matchers for use with ts-pattern */
export const swglMessages = {
  ...messages,
  setCode: schema(SetCode),
  run: schema(Run)
};

/**
 * Schema for the swgl (SwissGL shader) object.
 */
export const swglSchema: ObjectSchema = {
  type: 'swgl',
  category: 'video',
  description: 'Creates a SwissGL shader for WebGL2 graphics',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: SetCode, description: 'Set the code in the editor' },
        { schema: Run, description: 'Evaluate code and update visuals' }
      ]
    }
  ],
  outlets: [],
  tags: ['shader', 'webgl', 'graphics', 'gpu', '3d', 'mesh'],
  hasDynamicOutlets: true
};
