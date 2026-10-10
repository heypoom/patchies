import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from '$lib/objects/schemas/types';
import { schema } from '$lib/objects/schemas/types';
import { msg, sym } from '$lib/objects/schemas/helpers';
import { Bang, Stop, messages } from '$lib/objects/schemas/common';

// AI TTS-specific message schemas
const Speak = msg('speak', { text: Type.String() });
const Load = msg('load', { text: Type.String() });
const Play = sym('play');
const SetVoice = msg('setVoice', { value: Type.String() });
const SetStyle = msg('setStyle', { value: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const aiTtsMessages = {
  ...messages,
  speak: schema(Speak),
  load: schema(Load),
  play: schema(Play),
  setVoice: schema(SetVoice),
  setStyle: schema(SetStyle),
  string: schema(Type.String())
};

/**
 * Schema for the ai.tts (AI text-to-speech) object.
 */
export const aiTtsSchema: ObjectSchema = {
  type: 'ai.tts',
  category: 'ai',
  description: 'Convert text to speech using Gemini or Paxa TTS',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      handle: { handleType: 'message', handleId: 0 },
      messages: [
        { schema: Type.String(), description: 'Generate and play speech for the text' },
        { schema: Speak, description: 'Generate and play speech (explicit format)' },
        { schema: Load, description: 'Generate speech without playing (preload)' },
        { schema: Play, description: 'Play cached audio' },
        { schema: Bang, description: 'Play cached audio' },
        { schema: Stop, description: 'Stop playback' },
        {
          schema: SetVoice,
          description: 'Set voice for the selected provider (e.g., "Kore" or "khanomkrok")'
        },
        {
          schema: SetStyle,
          description: 'Set Gemini speaking style (e.g., "cheerful and friendly")'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio output',
      handle: { handleType: 'audio', handleId: 0 }
    }
  ],
  tags: ['ai', 'tts', 'speech', 'voice', 'audio', 'google', 'paxa'],
  hasDynamicOutlets: true
};
