import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg, sym } from './helpers';
import { Bang, Stop, Toggle, messages } from './common';

// STT-specific message schemas
const Listen = sym('listen');
const SetLang = msg('setLang', { value: Type.String() });
const Interim = msg('interim', { text: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const sttMessages = {
  ...messages,
  listen: schema(Listen),
  setLang: schema(SetLang),
  interim: schema(Interim),
  string: schema(Type.String())
};

/**
 * Schema for the stt (Speech-to-Text) object.
 */
export const sttSchema: ObjectSchema = {
  type: 'stt',
  category: 'network',
  description: 'Transcribe speech to text using browser Web Speech API',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      handle: { handleType: 'message', handleId: 0 },
      messages: [
        { schema: Listen, description: 'Start listening' },
        { schema: Stop, description: 'Stop listening' },
        { schema: Bang, description: 'Toggle listening on/off' },
        { schema: Toggle, description: 'Toggle listening on/off' },
        { schema: SetLang, description: 'Set BCP-47 language (e.g. en-US, th-TH)' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Transcribed text output',
      handle: { handleType: 'message', handleId: 0 },
      messages: [
        { schema: Type.String(), description: 'Transcribed text string' },
        { schema: Interim, description: 'Interim (partial) transcription result' }
      ]
    }
  ],
  tags: ['stt', 'speech', 'transcription', 'microphone', 'web-api']
};
