import type { ObjectSchema } from './types';
import { Run, SetCode } from './common';

/**
 * Schema for the shaderpark object.
 */
export const shaderparkSchema: ObjectSchema = {
  type: 'shaderpark',
  category: 'video',
  description: 'Creates Shader Park/Sculpt raymarched visuals for the render pipeline',
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
  tags: ['shader', 'shaderpark', 'sdf', 'raymarching', 'visual', 'graphics', 'generative'],
  hasDynamicOutlets: true,
  handlePatterns: {
    inlet: {
      template: 'video-in-{index}',
      handleType: 'video',
      description:
        'Video inlets are bound as sampler2D uniforms iChannel0, iChannel1, iChannel2, iChannel3'
    },
    outlet: {
      template: 'video-out-{index}',
      handleType: 'video',
      description: 'Video outlet'
    }
  }
};
