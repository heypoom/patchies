import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the mic~ (microphone input) object.
 */
export const micSchema: ObjectSchema = {
  type: 'mic~',
  category: 'audio',
  description: 'Captures audio from microphone with bang to restart',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [{ schema: Type.Literal('bang'), description: 'Bang to restart microphone input' }]
    }
  ],
  outlets: [
    {
      id: 'audio',
      description: 'Microphone audio output'
    }
  ],
  tags: ['audio', 'input', 'microphone', 'mic', 'source']
};
