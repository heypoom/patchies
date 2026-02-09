import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { messages } from './common';

// Hydra-specific message schemas
const SetCode = msg('setCode', { code: Type.String() });
const Run = sym('run');

/** Pre-wrapped matchers for use with ts-pattern */
export const hydraMessages = {
  ...messages,
  setCode: schema(SetCode),
  run: schema(Run)
};

/**
 * Schema for the hydra (Hydra video synthesizer) object.
 */
export const hydraSchema: ObjectSchema = {
  type: 'hydra',
  category: 'video',
  description: 'Creates a Hydra live coding video synthesizer',
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
  tags: ['video', 'synthesizer', 'livecoding', 'visual', 'shader', 'generative'],
  hasDynamicOutlets: true
};
