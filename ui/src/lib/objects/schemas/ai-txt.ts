import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';
import { Bang, messages } from './common';

// AI text-specific message schemas
const Generate = msg('generate', { prompt: Type.String() });
const SetPrompt = msg('set', { prompt: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const aiTxtMessages = {
  ...messages,
  generate: schema(Generate),
  setPrompt: schema(SetPrompt),
  string: schema(Type.String())
};

/**
 * Schema for the ai.txt (AI text generation) object.
 */
export const aiTxtSchema: ObjectSchema = {
  type: 'ai.txt',
  category: 'ai',
  description: 'Generate text using AI language models (Gemini)',
  inlets: [
    {
      id: 'message',
      description: 'Text prompts',
      messages: [
        { schema: Type.String(), description: 'Text prompt - sets prompt and generates' },
        { schema: Generate, description: 'Set prompt and generate text' },
        { schema: SetPrompt, description: 'Set prompt without generating' },
        { schema: Bang, description: 'Generate text with current prompt' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Generated text',
      messages: [{ schema: Type.String(), description: 'Generated text response' }]
    }
  ],
  tags: ['ai', 'text', 'generation', 'llm', 'gemini']
};
