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
  hasDynamicOutlets: true,
  handlePatterns: {
    inlet: {
      template: 'audio-in-{index}',
      handleType: 'audio',
      description:
        'Audio inlets (if only 1 audio inlet, handle is "audio-in" with NO index). Message inlets use message-in-{index}'
    },
    outlet: {
      template: 'audio-out-{index}',
      handleType: 'audio',
      description:
        'Audio outlets (if only 1 audio outlet, handle is "audio-out" with NO index). Message outlets use message-out-{index}'
    }
  }
};
