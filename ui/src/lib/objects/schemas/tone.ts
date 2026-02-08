import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the tone~ (Tone.js synthesis) object.
 */
export const toneSchema: ObjectSchema = {
  type: 'tone~',
  category: 'audio',
  description: 'Tone.js synthesis and audio processing framework',
  inlets: [
    {
      id: 'audio',
      description: 'Audio input (inputNode)'
    },
    {
      id: 'message',
      description: 'Control messages via recv()',
      messages: [{ schema: Type.Any(), description: 'Data received via recv() callback' }]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Output from send() calls',
      messages: [{ schema: Type.Any(), description: 'Data sent via send() function' }]
    }
  ],
  tags: ['audio', 'synthesis', 'tonejs', 'effects', 'music'],
  hasDynamicOutlets: true
};
