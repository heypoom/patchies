import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, Stop, messages } from './common';

// AI TTS-specific message schemas
const Speak = msg('speak', { text: Type.String() });
const Load = msg('load', { text: Type.String() });
const Play = sym('play');
const SetVoice = msg('setVoice', { value: Type.String() });
const SetRate = msg('setRate', { value: Type.Number() });
const SetPitch = msg('setPitch', { value: Type.Number() });
const SetVolume = msg('setVolume', { value: Type.Number() });

/** Pre-wrapped matchers for use with ts-pattern */
export const aiTtsMessages = {
  ...messages,
  speak: schema(Speak),
  load: schema(Load),
  play: schema(Play),
  setVoice: schema(SetVoice),
  setRate: schema(SetRate),
  setPitch: schema(SetPitch),
  setVolume: schema(SetVolume)
};

/**
 * Schema for the ai.tts (AI text-to-speech) object.
 */
export const aiTtsSchema: ObjectSchema = {
  type: 'ai.tts',
  category: 'ai',
  description: 'Convert text to speech using Google Cloud Text-to-Speech AI',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Type.String(), description: 'Generate and play speech for the text' },
        { schema: Speak, description: 'Generate and play speech (explicit format)' },
        { schema: Load, description: 'Generate speech without playing (preload)' },
        { schema: Play, description: 'Play cached audio' },
        { schema: Bang, description: 'Play cached audio' },
        { schema: Stop, description: 'Stop playback' },
        { schema: SetVoice, description: 'Set voice (e.g., "en-US-Chirp3-HD-Achernar")' },
        { schema: SetRate, description: 'Set speaking rate (0.25-4)' },
        { schema: SetPitch, description: 'Set pitch (-20 to 20)' },
        { schema: SetVolume, description: 'Set volume gain in dB (-96 to 16)' }
      ]
    }
  ],
  outlets: [],
  tags: ['ai', 'tts', 'speech', 'voice', 'audio', 'google'],
  hasDynamicOutlets: true
};
