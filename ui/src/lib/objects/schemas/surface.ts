import { Type } from '@sinclair/typebox';
import { msg } from './helpers';
import type { ObjectSchema } from './types';
import { Run, SetCode } from './common';

export const SurfaceExpand = msg('expand', {});
export const SurfaceCollapse = msg('collapse', {});

export const surfaceSchema: ObjectSchema = {
  type: 'surface',
  category: 'video',
  description: 'Fullscreen transparent canvas overlay for pointer and touch interaction',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: SetCode, description: 'Set the code in the editor' },
        { schema: Run, description: 'Evaluate code and update visuals' },
        { schema: SurfaceExpand, description: 'Enter fullscreen surface mode' },
        { schema: SurfaceCollapse, description: 'Exit fullscreen surface mode' }
      ]
    }
  ],
  outlets: [
    {
      id: 'video',
      description: 'Video output',
      handle: {
        handleType: 'video'
      }
    },
    {
      id: 'pointer',
      description: 'Pointer events',
      messages: [
        {
          schema: Type.Object({
            x: Type.Number({ description: 'X coordinate of the pointer event' }),
            y: Type.Number({ description: 'Y coordinate of the pointer event' }),
            buttons: Type.Number({ description: 'Bitmask of pressed buttons' }),
            down: Type.Boolean({ description: 'Whether the pointer is currently down' }),
            type: Type.Union(
              [
                Type.Literal('pointerdown'),
                Type.Literal('pointermove'),
                Type.Literal('pointerup'),
                Type.Literal('pointercancel')
              ],
              { description: 'Type of pointer event' }
            )
          }),
          description: 'Pointer event object with x, y, buttons, down, and type'
        }
      ]
    }
  ],
  tags: ['graphics', 'interaction', 'touch', 'pointer', 'mouse', 'fullscreen', 'overlay', '2d'],
  hasDynamicOutlets: true,
  handlePatterns: {
    inlet: { template: 'in-{index}', description: 'Message inlets (0-indexed)' },
    outlet: {
      template: 'video-out-{index}',
      handleType: 'video',
      description:
        'Video output at index 0, pointer events at index 1, message outlets use out-{index}'
    }
  }
};
