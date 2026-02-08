import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Stop, Pause, messages } from './common';

// TTS-specific message schemas
const SetVoice = msg('setVoice', { value: Type.String() });
const SetRate = msg('setRate', { value: Type.Number() });
const SetPitch = msg('setPitch', { value: Type.Number() });
const SetVolume = msg('setVolume', { value: Type.Number() });
const Resume = sym('resume');

// Outlet message schemas
const Start = msg('start', { text: Type.String() });
const End = msg('end', { text: Type.String() });
const Error = msg('error', { message: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const ttsMessages = {
  ...messages,
  setVoice: schema(SetVoice),
  setRate: schema(SetRate),
  setPitch: schema(SetPitch),
  setVolume: schema(SetVolume),
  resume: schema(Resume),
  start: schema(Start),
  end: schema(End),
  error: schema(Error)
};

/**
 * Schema for the tts (Text-to-Speech) object.
 */
export const ttsSchema: ObjectSchema = {
  type: 'tts',
  category: 'network',
  description: 'Speak text aloud using browser Web Speech API',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Type.String(), description: 'Speak the text' },
        { schema: SetVoice, description: 'Set the voice by name' },
        { schema: SetRate, description: 'Set speech rate (0.1-10, default: 1)' },
        { schema: SetPitch, description: 'Set pitch (0-2, default: 1)' },
        { schema: SetVolume, description: 'Set volume (0-1, default: 1)' },
        { schema: Stop, description: 'Stop current speech' },
        { schema: Pause, description: 'Pause current speech' },
        { schema: Resume, description: 'Resume paused speech' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Speech events',
      messages: [
        { schema: Start, description: 'Speech started' },
        { schema: End, description: 'Speech finished' },
        { schema: Error, description: 'An error occurred' }
      ]
    }
  ],
  tags: ['network', 'tts', 'speech', 'voice', 'audio']
};
