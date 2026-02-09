import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Run, Stop, SetCodeMessage } from './common';

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
      description: 'Control messages and data input',
      messages: [
        { schema: SetCodeMessage, description: 'Set the code in the editor' },
        { schema: Run, description: 'Execute the code' },
        { schema: Stop, description: 'Stop running code' },
        { schema: Type.Any(), description: 'Data received via recv() callback' }
      ]
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
