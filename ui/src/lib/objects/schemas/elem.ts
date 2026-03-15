import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the elem~ (Elementary Audio) object.
 */
export const elemSchema: ObjectSchema = {
  type: 'elem~',
  category: 'audio',
  description: 'Elementary Audio declarative DSP library',
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
  tags: ['audio', 'synthesis', 'elementary', 'dsp', 'declarative'],
  hasDynamicOutlets: true,
  handlePatterns: {
    inlet: {
      template: 'message-in-{index}',
      handleType: 'message',
      description: 'Message inlets (0-indexed)'
    },
    outlet: {
      template: 'message-out-{index}',
      handleType: 'message',
      description: 'Message outlets (0-indexed)'
    }
  }
};
