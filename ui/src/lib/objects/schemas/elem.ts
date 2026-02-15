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
  tags: ['audio', 'synthesis', 'elementary', 'dsp', 'declarative'],
  hasDynamicOutlets: true
};
