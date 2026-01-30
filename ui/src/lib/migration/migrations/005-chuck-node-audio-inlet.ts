import type { Migration } from '../types';

/**
 * Migration 005: Add audio inlet to chuck~ nodes
 *
 * Before: chuck~ had a single message inlet (message-in)
 * After: chuck~ has an audio inlet (audio-in-0) and message inlet (message-in-1)
 *
 * Handle ID changes:
 * - Old message inlet: message-in -> message-in-1
 */
export const migration005: Migration = {
  version: 5,
  name: 'chuck-node-audio-inlet',

  migrate(patch) {
    if (!patch.edges || !patch.nodes) return patch;

    // Find all chuck~ node IDs
    const chuckNodeIds = new Set(
      patch.nodes.filter((node) => node.type === 'chuck~').map((node) => node.id)
    );

    if (chuckNodeIds.size === 0) return patch;

    // Update edges targeting chuck~ nodes
    const migratedEdges = patch.edges.map((edge) => {
      if (!chuckNodeIds.has(edge.target)) return edge;

      // Migrate message inlet handle: message-in -> message-in-1
      if (edge.targetHandle === 'message-in') {
        return {
          ...edge,
          targetHandle: 'message-in-1'
        };
      }

      return edge;
    });

    return { ...patch, edges: migratedEdges };
  }
};
