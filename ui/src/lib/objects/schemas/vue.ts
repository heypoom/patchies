import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

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
