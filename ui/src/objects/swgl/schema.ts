import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Run, SetCode } from '$lib/objects/schemas/common';

/**
 * Schema for the swgl (SwissGL shader) object.
 */
export const swglSchema: ObjectSchema = {
  type: 'swgl',
  category: 'video',
  description: 'Creates a SwissGL shader for WebGL2 graphics',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      handle: { handleType: 'message', handleId: '0' },
      messages: [
        { schema: SetCode, description: 'Set the code in the editor' },
        { schema: Run, description: 'Evaluate code and update visuals' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Message output',
      handle: { handleType: 'message', handleId: '0' }
    }
  ],
  tags: ['shader', 'webgl', 'graphics', 'gpu', '3d', 'mesh'],
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
