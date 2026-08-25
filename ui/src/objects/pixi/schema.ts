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
  inlets: []
};
