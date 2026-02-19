import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

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
      description: 'Hot inlet ($1)',
      messages: [{ schema: Type.Any(), description: 'Value stored as $1' }]
    }
  ],
  outlets: [
    {
      id: 'result',
      description: 'UIUA evaluation result'
    }
  ],
  tags: ['programming', 'array', 'uiua', 'stack', 'functional']
};
