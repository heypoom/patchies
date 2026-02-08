import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

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
