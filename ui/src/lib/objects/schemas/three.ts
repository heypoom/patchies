import type { ObjectSchema } from './types';
import { Run, SetCodeMessage } from './common';

/**
 * Schema for the three (offscreen Three.js) object.
 */
export const threeSchema: ObjectSchema = {
  type: 'three',
  category: 'video',
  description: 'Creates Three.js 3D graphics on web worker',
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
  tags: ['3d', 'webgl', 'graphics', 'animation', 'scene'],
  hasDynamicOutlets: true
};

/**
 * Schema for the three.dom (main thread Three.js) object.
 */
export const threeDomSchema: ObjectSchema = {
  type: 'three.dom',
  category: 'video',
  description: 'Creates Three.js 3D graphics with interactivity',
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
  tags: ['3d', 'webgl', 'graphics', 'animation', 'scene', 'interactive'],
  hasDynamicOutlets: true
};
