import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the dsp~ (JavaScript DSP processor) object.
 */
export const dspSchema: ObjectSchema = {
  type: 'dsp~',
  category: 'audio',
  description: 'Dynamic JavaScript DSP processor using AudioWorklet',
  inlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio input'
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
  tags: ['audio', 'dsp', 'javascript', 'worklet', 'processing'],
  hasDynamicOutlets: true
};
