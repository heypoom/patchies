import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

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
      messages: [{ schema: Type.String(), description: 'Text prompt for generation' }]
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
