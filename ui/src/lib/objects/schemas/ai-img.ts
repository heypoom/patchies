import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the ai.img (AI image generation) object.
 */
export const aiImgSchema: ObjectSchema = {
  type: 'ai.img',
  category: 'ai',
  description: 'Generate images from text prompts using AI (Gemini)',
  inlets: [
    {
      id: 'message',
      description: 'Image prompts',
      messages: [{ schema: Type.String(), description: 'Text prompt for image generation' }]
    }
  ],
  outlets: [],
  tags: ['ai', 'image', 'generation', 'gemini', 'visual'],
  hasDynamicOutlets: true
};
