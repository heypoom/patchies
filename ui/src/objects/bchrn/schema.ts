import type { ObjectSchema } from '$lib/objects/schemas/types';

export const bchrnSchema: ObjectSchema = {
  type: 'bchrn',
  category: 'video',
  description: 'Creates Butterchurn audio-reactive visuals',
  inlets: [],
  outlets: [
    {
      id: 'video',
      type: 'video',
      description: 'Video output',
      handle: { handleType: 'video', handleId: '0' }
    }
  ],
  tags: ['visual', 'music', 'audio', 'butterchurn']
};
