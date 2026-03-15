import type { ObjectSchema } from './types';
import { Run, SetCode } from './common';

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
        { schema: SetCode, description: 'Set the code in the editor' },
        { schema: Run, description: 'Evaluate code and update visuals' }
      ]
    }
  ],
  outlets: [],
  tags: ['3d', 'webgl', 'graphics', 'animation', 'scene'],
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
        { schema: SetCode, description: 'Set the code in the editor' },
        { schema: Run, description: 'Evaluate code and update visuals' }
      ]
    }
  ],
  outlets: [],
  tags: ['3d', 'webgl', 'graphics', 'animation', 'scene', 'interactive'],
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
