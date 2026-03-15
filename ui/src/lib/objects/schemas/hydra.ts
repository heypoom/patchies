import type { ObjectSchema } from './types';
import { Run, SetCode } from './common';

/**
 * Schema for the hydra (Hydra video synthesizer) object.
 */
export const hydraSchema: ObjectSchema = {
  type: 'hydra',
  category: 'video',
  description: 'Creates a Hydra live coding video synthesizer',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: SetCode, description: 'Set the code in the editor' },
        { schema: Run, description: 'Evaluate code and update visuals' }
      ]
    }
  ],
  outlets: [],
  tags: ['video', 'synthesizer', 'livecoding', 'visual', 'shader', 'generative'],
  hasDynamicOutlets: true,
  handlePatterns: {
    inlet: {
      template: 'video-in-{index}',
      handleType: 'video',
      description: 'Video inlets (0-indexed), message inlets use message-in-{index}'
    },
    outlet: {
      template: 'video-out-{index}',
      handleType: 'video',
      description: 'Video outlets (0-indexed), message outlets use message-out-{index}'
    }
  }
};
