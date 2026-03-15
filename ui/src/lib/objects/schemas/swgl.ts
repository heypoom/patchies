import type { ObjectSchema } from './types';
import { Run, SetCode } from './common';

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
      id: 'video',
      type: 'video',
      description: 'Video output',
      handle: { handleType: 'video', handleId: '0' }
    },
    {
      id: 'message',
      description: 'Message output',
      handle: { handleType: 'message', handleId: '0' }
    }
  ],
  tags: ['shader', 'webgl', 'graphics', 'gpu', '3d', 'mesh']
};
