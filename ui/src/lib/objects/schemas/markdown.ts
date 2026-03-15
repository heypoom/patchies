import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { messages } from './common';

/** Pre-wrapped matchers for use with ts-pattern */
export const markdownMessages = {
  ...messages,
  string: schema(Type.String())
};

/**
 * Schema for the markdown (Markdown renderer) object.
 */
export const markdownSchema: ObjectSchema = {
  type: 'markdown',
  category: 'documentation',
  description: 'Render Markdown text as formatted content',
  inlets: [
    {
      id: 'message',
      description: 'Markdown content',
      handle: { handleType: 'message' },
      messages: [{ schema: Type.String(), description: 'Markdown text to render' }]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Current markdown content',
      handle: { handleType: 'message' },
      messages: [{ schema: Type.String(), description: 'Current markdown content' }]
    }
  ],
  tags: ['documentation', 'markdown', 'text', 'display']
};
