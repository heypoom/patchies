import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, Stop, messages } from './common';

// AI STT-specific message schemas
const Listen = sym('listen');
const SetLanguage = msg('setLanguage', { value: Type.String() });
const SetPrompt = msg('setPrompt', { value: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const aiSttMessages = {
  ...messages,
  listen: schema(Listen),
  setLanguage: schema(SetLanguage),
  setPrompt: schema(SetPrompt)
};

/**
 * Schema for the ai.stt (AI speech-to-text) object.
 */
export const aiSttSchema: ObjectSchema = {
  type: 'ai.stt',
  category: 'ai',
  description: 'Transcribe speech to text using Gemini AI',
  inlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio input to transcribe (connect mic~ or any audio source)',
      handle: { handleType: 'audio', handleId: 0 }
    },
    {
      id: 'message',
      description: 'Control messages',
      handle: { handleType: 'message', handleId: 1 },
      messages: [
        { schema: Listen, description: 'Start recording' },
        { schema: Stop, description: 'Stop recording and transcribe' },
        { schema: Bang, description: 'Toggle recording on/off' },
        { schema: SetLanguage, description: 'Set BCP-47 language hint' },
        { schema: SetPrompt, description: 'Set transcription context/prompt hint' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Transcribed text output',
      handle: { handleType: 'message', handleId: 0 },
      messages: [{ schema: Type.String(), description: 'Transcribed text string' }]
    }
  ],
  tags: ['ai', 'stt', 'speech', 'transcription', 'microphone', 'gemini']
};
