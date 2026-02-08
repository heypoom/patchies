import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the ai.music (AI music generation) object.
 */
export const aiMusicSchema: ObjectSchema = {
  type: 'ai.music',
  category: 'ai',
  description: 'Generate musical compositions using AI (Lyria)',
  inlets: [
    {
      id: 'message',
      description: 'Music prompts',
      messages: [{ schema: Type.String(), description: 'Text prompt for music generation' }]
    }
  ],
  outlets: [],
  tags: ['ai', 'music', 'generation', 'audio', 'lyria'],
  hasDynamicOutlets: true
};
