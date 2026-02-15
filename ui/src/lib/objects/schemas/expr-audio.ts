import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the expr~ (audio-rate expression evaluator) object.
 */
export const exprAudioSchema: ObjectSchema = {
  type: 'expr~',
  category: 'audio',
  description: 'Audio-rate mathematical expression evaluator for DSP',
  inlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio input (s, samples, input variables)'
    },
    {
      id: 'message',
      description: 'Control values for $1-$9 variables',
      messages: [{ schema: Type.Number(), description: 'Value for dynamic inlet variable' }]
    }
  ],
  outlets: [],
  tags: ['audio', 'expression', 'dsp', 'math', 'synthesis'],
  hasDynamicOutlets: true
};
