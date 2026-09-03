import type { ObjectSchema } from '$lib/objects/schemas/types';
import { Run, SetCode } from '$lib/objects/schemas/common';

export const pixiSchema: ObjectSchema = {
  type: 'pixi',
  category: 'video',
  description: 'Creates Pixi.js graphics in the rendering pipeline',
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
  tags: ['2d', 'webgl', 'graphics', 'animation']
};

export const pixiDomSchema: ObjectSchema = {
  ...pixiSchema,
  type: 'pixi.dom',
  description: 'Creates interactive Pixi.js graphics on the main thread',
  inlets: [],
  hasDynamicOutlets: true,
  handlePatterns: {
    inlet: { template: 'in-{index}', description: 'Message inlets (0-indexed)' },
    outlet: {
      template: 'video-out-{index}',
      handleType: 'video',
      description: 'Video output at index 0, message outlets use out-{index}'
    }
  }
};
