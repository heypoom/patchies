import type { ObjectSchema } from './types';

/**
 * Schema for the shaderpark object.
 */
export const shaderparkSchema: ObjectSchema = {
  type: 'shaderpark',
  category: 'video',
  description: 'Creates Shader Park raymarched visuals for the render pipeline',
  inlets: [],
  outlets: [],
  tags: ['shader', 'shaderpark', 'sdf', 'raymarching', 'visual', 'graphics', 'generative'],
  hasDynamicOutlets: true,
  handlePatterns: {
    inlet: {
      template: 'video-in-{index}',
      handleType: 'video',
      description:
        'Video inlets are shown for referenced sampler uniforms; message inlets are generated from input()/input2D() settings and also accept setCode/run control messages'
    },
    outlet: {
      template: 'video-out-{index}',
      handleType: 'video',
      description: 'Video outlet'
    }
  }
};
