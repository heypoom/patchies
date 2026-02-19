import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { Bang, SetCode } from './common';

/**
 * Schema for the uiua (UIUA array language) object.
 */
export const uiuaSchema: ObjectSchema = {
  type: 'uiua',
  category: 'programming',
  description: 'UIUA array programming language with dynamic inlets using $1-$9 variables',
  inlets: [
    {
      id: 'hot',
      description: 'Hot inlet ($1) - triggers evaluation',
      messages: [
        { schema: Type.Any(), description: 'Value stored as $1, triggers evaluation' },
        { schema: Bang, description: 'Trigger evaluation with current values' },
        { schema: SetCode, description: 'Set UIUA expression dynamically' }
      ]
    },
    { id: 'cold', description: 'Cold inlets ($2 - $9) - store values without triggering' }
  ],
  outlets: [
    {
      id: 'result',
      description: 'UIUA evaluation result'
    }
  ],
  tags: ['programming', 'array', 'uiua', 'stack', 'functional']
};
