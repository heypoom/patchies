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
    }
  ],
  tags: ['graphics', 'interaction', 'touch', 'pointer', 'mouse', 'fullscreen', 'overlay', '2d'],
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
