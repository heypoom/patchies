import type { Node } from '@xyflow/svelte';

export const DEFAULT_GROUP_WIDTH = 360;
export const DEFAULT_GROUP_HEIGHT = 240;

export function getDefaultNodeDimensions(type: string): Pick<Node, 'width' | 'height'> {
  if (type === 'group') {
    return {
      width: DEFAULT_GROUP_WIDTH,
      height: DEFAULT_GROUP_HEIGHT
    };
  }

  return {};
}
