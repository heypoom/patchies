import type { Migration } from '../types';

/**
 * Migration 006: Rename dac~ to out~
 *
 * This migration renames the audio output node from 'dac~' to 'out~' for consistency
 * with the naming convention used elsewhere (mic~ instead of adc~, bg.out for background).
 *
 * Changes:
 * 1. Converts type: 'dac~' nodes to type: 'out~'
 * 2. Edge handles remain the same (audio-in-0) since they use the 'audio' type prefix
 */
export const migration006: Migration = {
  version: 6,
  name: 'dac-to-out',

  migrate(patch) {
    if (!patch.nodes) return patch;

    const migratedNodes = patch.nodes.map((node) => {
      if (node.type === 'dac~') {
        return { ...node, type: 'out~' };
      }

      return node;
    });

    return { ...patch, nodes: migratedNodes };
  }
};
