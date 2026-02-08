import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';
import { Bang, Pause, messages } from './common';

// Webcam-specific message schemas
const Size = msg('size', {
  width: Type.Number(),
  height: Type.Number()
});

/** Pre-wrapped matchers for use with ts-pattern */
export const webcamMessages = {
  ...messages,
  size: schema(Size)
};

/**
 * Schema for the webcam (camera capture) object.
 */
export const webcamSchema: ObjectSchema = {
  type: 'webcam',
  category: 'video',
  description: 'Capture live video from your webcam/camera',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        {
          schema: Bang,
          description: 'Start webcam capture'
        },
        {
          schema: Pause,
          description: 'Toggle pause/resume capture'
        },
        {
          schema: Size,
          description: 'Set capture resolution'
        }
      ]
    }
  ],
  outlets: [],
  tags: ['camera', 'capture', 'live', 'texture', 'visual'],
  hasDynamicOutlets: true
};
