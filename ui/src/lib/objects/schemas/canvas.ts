import type { ObjectSchema } from './types';
import { Run, SetCode } from './common';

/**
 * Schema for the canvas (offscreen JavaScript canvas) object.
 */
export const canvasSchema: ObjectSchema = {
  type: 'canvas',
  category: 'video',
  description: 'Creates an offscreen JavaScript canvas for graphics',
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
  tags: ['graphics', 'drawing', 'animation', 'html5', '2d', 'offscreen'],
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

/**
 * Schema for the canvas.dom (main thread JavaScript canvas) object.
 */
export const canvasDomSchema: ObjectSchema = {
  type: 'canvas.dom',
  category: 'video',
  description: 'Creates a JavaScript canvas on main thread with DOM access',
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
  tags: ['graphics', 'drawing', 'animation', 'html5', '2d', 'interactive', 'mouse', 'keyboard'],
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
