import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';
import { messages } from './common';

// Markdown-specific message schemas
const SetValue = msg('set', { value: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const markdownMessages = {
  ...messages,
  setValue: schema(SetValue),
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
      messages: [{ schema: Type.String(), description: 'Markdown text to render' }]
    }
  ],
  outlets: [],
  tags: ['documentation', 'markdown', 'text', 'display']
};
