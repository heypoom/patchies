import type { ObjectSchema } from './types';
import { Run, SetCodeMessage } from './common';

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
        { schema: SetCodeMessage, description: 'Set the code in the editor' },
        { schema: Run, description: 'Evaluate code and update visuals' }
      ]
    }
  ],
  outlets: [],
  tags: ['graphics', 'drawing', 'animation', 'html5', '2d', 'offscreen'],
  hasDynamicOutlets: true
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
        { schema: SetCodeMessage, description: 'Set the code in the editor' },
        { schema: Run, description: 'Evaluate code and update visuals' }
      ]
    }
  ],
  outlets: [],
  tags: ['graphics', 'drawing', 'animation', 'html5', '2d', 'interactive', 'mouse', 'keyboard'],
  hasDynamicOutlets: true
};
