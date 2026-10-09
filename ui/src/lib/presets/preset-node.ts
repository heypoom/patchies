import type { Node } from '@xyflow/svelte';
import type { Preset } from './types';

export const getPresetDimensions = (preset: Pick<Preset, 'width' | 'height'>) => ({
  ...(preset.width !== undefined ? { width: preset.width } : {}),
  ...(preset.height !== undefined ? { height: preset.height } : {})
});

export function createNodePreset(node: Node, name: string, description?: string): Preset {
  if (!node.type) {
    throw new Error('Cannot save a preset without a node type');
  }

  return {
    name,
    description,
    type: node.type,
    data: node.data,
    ...getPresetDimensions(node)
  };
}
