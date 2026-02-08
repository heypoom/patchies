import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the sonic~ (SuperSonic/SuperCollider) object.
 */
export const sonicSchema: ObjectSchema = {
  type: 'sonic~',
  category: 'audio',
  description: 'SuperCollider scsynth audio engine via SuperSonic',
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
  tags: ['audio', 'synthesis', 'supercollider', 'scsynth', 'supersonic'],
  hasDynamicOutlets: true
};
