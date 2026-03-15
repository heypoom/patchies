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
      type: 'signal',
      description: 'Audio input (inputNode)',
      handle: { handleType: 'audio' }
    },
    {
      id: 'message',
      description: 'Control messages via recv()',
      messages: [{ schema: Type.Any(), description: 'Data received via recv() callback' }]
    }
  ],
  outlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio output (outputNode)',
      handle: { handleType: 'audio' }
    },
    {
      id: 'message',
      description: 'Output from send() calls',
      messages: [{ schema: Type.Any(), description: 'Data sent via send() function' }]
    }
  ],
  tags: ['audio', 'synthesis', 'supercollider', 'scsynth', 'supersonic'],
  hasDynamicOutlets: true,
  handlePatterns: {
    inlet: { template: 'in-{index}' },
    outlet: { template: 'out-{index}' }
  }
};
