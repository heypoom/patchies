import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';
import { Bang, messages } from './common';

// AI image-specific message schemas
const Generate = msg('generate', { prompt: Type.String() });
const SetPrompt = msg('set', { prompt: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const aiImgMessages = {
  ...messages,
  generate: schema(Generate),
  setPrompt: schema(SetPrompt),
  string: schema(Type.String())
};

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
