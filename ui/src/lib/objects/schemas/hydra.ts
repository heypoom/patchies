import type { ObjectSchema } from './types';
import { Run, SetCodeMessage } from './common';

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
        { schema: SetCodeMessage, description: 'Set the code in the editor' },
        { schema: Run, description: 'Evaluate code and update visuals' }
      ]
    }
  ],
  outlets: [],
  tags: ['video', 'synthesizer', 'livecoding', 'visual', 'shader', 'generative'],
  hasDynamicOutlets: true
};
