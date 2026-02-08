import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the expr (expression evaluator) object.
 */
export const exprSchema: ObjectSchema = {
  type: 'expr',
  category: 'programming',
  description: 'Evaluate mathematical expressions and formulas using $1-$9 variables',
  inlets: [
    {
      id: 'hot',
      description: 'Hot inlet ($1) - triggers evaluation when message arrives',
      messages: [{ schema: Type.Any(), description: 'Value stored as $1, triggers evaluation' }]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Expression result',
      messages: [{ schema: Type.Any(), description: 'Result of the expression evaluation' }]
    }
  ],
  tags: ['programming', 'expression', 'math', 'formula', 'control'],
  hasDynamicOutlets: true
};
