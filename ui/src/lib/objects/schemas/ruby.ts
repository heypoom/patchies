import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';

// Ruby-specific message schemas
const SetCode = msg('setCode', { code: Type.String() });
const Run = sym('run');
const Stop = sym('stop');

/** Pre-wrapped matchers for use with ts-pattern */
export const rubyMessages = {
  setCode: schema(SetCode),
  run: schema(Run),
  stop: schema(Stop)
};

/**
 * Schema for the ruby (Ruby code environment) object.
 */
export const rubySchema: ObjectSchema = {
  type: 'ruby',
  category: 'programming',
  description: 'Run Ruby code directly in the browser using ruby.wasm',
  inlets: [
    {
      id: 'message',
      description: 'Control messages and data input',
      messages: [
        { schema: SetCode, description: 'Update the code' },
        { schema: Run, description: 'Execute the code' },
        { schema: Stop, description: 'Stop running tasks' },
        { schema: Type.Any(), description: 'Data received via recv block' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Output from emit calls',
      messages: [{ schema: Type.Any(), description: 'Data sent via emit method' }]
    }
  ],
  tags: ['programming', 'ruby', 'wasm', 'scripting'],
  hasDynamicOutlets: true
};
