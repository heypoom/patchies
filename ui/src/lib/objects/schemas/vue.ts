import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, messages } from './common';

// Vue-specific message schemas
const SetCode = msg('setCode', { code: Type.String() });
const Run = sym('run');
const Stop = sym('stop');

/** Pre-wrapped matchers for use with ts-pattern */
export const vueMessages = {
  ...messages,
  setCode: schema(SetCode),
  run: schema(Run),
  stop: schema(Stop)
};

/**
 * Schema for the vue (Vue.js UI) object.
 */
export const vueSchema: ObjectSchema = {
  type: 'vue',
  category: 'programming',
  description: 'Build custom UI components using Vue.js 3 with Composition API',
  inlets: [
    {
      id: 'message',
      description: 'Data input via recv() callback',
      messages: [{ schema: Type.Any(), description: 'Data received via recv() callback' }]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Output from send() calls',
      messages: [{ schema: Type.Any(), description: 'Data sent via send() function' }]
    }
  ],
  tags: ['programming', 'vue', 'ui', 'interface', 'component'],
  hasDynamicOutlets: true
};
