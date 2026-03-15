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
      handle: { handleType: 'audio', handleId: 0 }
    },
    {
      id: 'message',
      description: 'Control messages via recv()',
      handle: { handleType: 'message', handleId: 1 },
      messages: [{ schema: Type.Any(), description: 'Data received via recv() callback' }]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Output from send() calls',
      handle: { handleType: 'message', handleId: 0 },
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
