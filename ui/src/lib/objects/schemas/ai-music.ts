import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';
import { Bang, Play, Pause, messages } from './common';

// AI music-specific message schemas
const AddPrompt = msg('addPrompt', { prompt: Type.String(), weight: Type.Number() });
const DeletePrompt = msg('deletePrompt', { prompt: Type.String() });
const SetPrompts = msg('setPrompts', { prompts: Type.Any() });
const SetBPM = msg('setBpm', { value: Type.Number() });
const SetTemperature = msg('setTemperature', { value: Type.Number() });
const SetTopK = msg('setTopK', { value: Type.Number() });
const SetSeed = msg('setSeed', { value: Type.Number() });
const SetGuidance = msg('setGuidance', { value: Type.Number() });
const SetDensity = msg('setDensity', { value: Type.Number() });
const SetBrightness = msg('setBrightness', { value: Type.Number() });
const SetScale = msg('setScale', { value: Type.Any() });
const SetConfig = msg('setConfig', { config: Type.Any() });

/** Pre-wrapped matchers for use with ts-pattern */
export const aiMusicMessages = {
  ...messages,
  addPrompt: schema(AddPrompt),
  deletePrompt: schema(DeletePrompt),
  setPrompts: schema(SetPrompts),
  setBPM: schema(SetBPM),
  setTemperature: schema(SetTemperature),
  setTopK: schema(SetTopK),
  setSeed: schema(SetSeed),
  setGuidance: schema(SetGuidance),
  setDensity: schema(SetDensity),
  setBrightness: schema(SetBrightness),
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
      description: 'Music prompts and controls',
      messages: [
        { schema: Type.String(), description: 'Text prompt or JSON5 weighted prompts' },
        { schema: Bang, description: 'Toggle play/pause' },
        { schema: Play, description: 'Start playback' },
        { schema: Pause, description: 'Pause playback' },
        { schema: AddPrompt, description: 'Add a weighted prompt' },
        { schema: DeletePrompt, description: 'Remove a prompt' },
        { schema: SetPrompts, description: 'Set all prompts at once' },
        { schema: SetBPM, description: 'Set beats per minute' },
        { schema: SetTemperature, description: 'Set temperature (0-1)' },
        { schema: SetTopK, description: 'Set top-k sampling' },
        { schema: SetSeed, description: 'Set random seed' },
        { schema: SetGuidance, description: 'Set guidance strength' },
        { schema: SetDensity, description: 'Set note density' },
        { schema: SetBrightness, description: 'Set tonal brightness' },
        { schema: SetScale, description: 'Set musical scale' },
        { schema: SetConfig, description: 'Set generation config' }
      ]
    }
  ],
  outlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio output'
    }
  ],
  tags: ['ai', 'music', 'generation', 'audio', 'lyria'],
  hasDynamicOutlets: true
};
