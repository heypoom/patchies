import type { ObjectSchema } from './types';
import { Run, SetCode } from './common';

/**
 * Schema for the regl (low-level GPU rendering) object.
 */
export const reglSchema: ObjectSchema = {
  type: 'regl',
  category: 'video',
  description: 'Low-level GPU rendering with regl draw commands',
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
  tags: ['gpu', 'webgl', 'graphics', 'shader', 'geometry', 'low-level', 'regl'],
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
