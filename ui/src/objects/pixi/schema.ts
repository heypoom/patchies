import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Run, SetCode } from '$lib/objects/schemas/common';

export const pixiSchema: ObjectSchema = {
  type: 'pixi',
  category: 'video',
  description: 'Creates PixiJS 8 graphics in the worker render pipeline',
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
  tags: ['2d', 'webgl', 'graphics', 'animation'],
  hasDynamicOutlets: true,
  handlePatterns: {
    inlet: {
      template: 'message-in-{index}',
      handleType: 'message',
      description: 'Control messages'
    },
    outlet: { template: 'video-out-{index}', handleType: 'video', description: 'Video output' }
  }
};

export const pixiDomSchema: ObjectSchema = {
  ...pixiSchema,
  type: 'pixi.dom',
  description: 'Creates interactive PixiJS 8 graphics on the main thread'
};
