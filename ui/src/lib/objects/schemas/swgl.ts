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
      messages: [
        { schema: SetCode, description: 'Set the code in the editor' },
        { schema: Run, description: 'Evaluate code and update visuals' }
      ]
    }
  ],
  outlets: [],
  tags: ['shader', 'webgl', 'graphics', 'gpu', '3d', 'mesh'],
  hasDynamicOutlets: true
};
