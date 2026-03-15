import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Bang, SetCode } from './common';

/**
 * Schema for the uiua (Uiua array language) object.
 */
export const uiuaSchema: ObjectSchema = {
  type: 'uiua',
  category: 'programming',
  description: 'Uiua array programming language',
  inlets: [
    {
      id: 'hot',
      description: 'Hot inlet ($1) - triggers evaluation',
      handle: { handleType: 'message' },
      messages: [
        { schema: Type.Any(), description: 'Value stored as $1, triggers evaluation' },
        { schema: Bang, description: 'Trigger evaluation with current values' },
        { schema: SetCode, description: 'Set Uiua expression dynamically' }
      ]
    },
    {
      id: 'cold',
      description: 'Cold inlets ($2 - $9) - store values without triggering',
      handle: { handleType: 'message' }
    }
  ],
  outlets: [
    {
      id: 'result',
      description: 'Uiua evaluation result',
      handle: { handleType: 'message' }
    }
  ],
  tags: ['programming', 'array', 'uiua', 'stack', 'functional'],
  handlePatterns: {
    inlet: { template: 'in-{index}' },
    outlet: { template: 'out-{index}' }
  }
};
