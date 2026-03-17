import type { ObjectSchema } from './types';

export const projmapSchema: ObjectSchema = {
  type: 'projmap',
  category: 'video',
  description: 'Projection mapper — warps video textures onto N-point polygon surfaces',
  inlets: [],
  outlets: [
    {
      id: 'video-out-0',
      description: 'Composited video output',
      handle: { handleType: 'video', handleId: '0' }
    }
  ],
  hasDynamicOutlets: false,
  handlePatterns: {
    inlet: {
      template: 'video-in-{index}',
      handleType: 'video',
      description: 'Video source for surface N (0-indexed, one inlet per surface)'
    }
  },
  tags: ['video', 'projection', 'mapping', 'warp', 'surface', 'visual']
};
