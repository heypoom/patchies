import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';
import { messages } from './common';

// AI music-specific message schemas
const AddPrompt = msg('addPrompt', { prompt: Type.String(), weight: Type.Number() });
const DeletePrompt = msg('deletePrompt', { prompt: Type.String() });
const SetPrompts = msg('setPrompts', { prompts: Type.Any() });
const SetBPM = msg('setBpm', { value: Type.Number() });
const SetScale = msg('setScale', { scale: Type.Any() });
const SetConfig = msg('setConfig', { config: Type.Any() });

/** Pre-wrapped matchers for use with ts-pattern */
export const aiMusicMessages = {
  ...messages,
  addPrompt: schema(AddPrompt),
  deletePrompt: schema(DeletePrompt),
  setPrompts: schema(SetPrompts),
  setBPM: schema(SetBPM),
  setScale: schema(SetScale),
  setConfig: schema(SetConfig)
};

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
