import type { Migration } from '../types';

/**
 * Migration 011: Fix redundant handle IDs on sampler~, expr~, and ai.music
 *
 * These nodes had handleId values that duplicated the handleType, producing
 * double-prefixed IDs like `audio-out-audio-out` instead of `audio-out`.
 *
 * Affected edges:
 * - sampler~: audio-in-audio-in → audio-in, message-in-message-in → message-in, audio-out-audio-out → audio-out
 * - expr~: audio-out-audio-out → audio-out
 * - ai.music: audio-out-audio-out → audio-out
 */
export const migration011: Migration = {
  version: 11,
  name: 'fix-redundant-handle-ids',

  migrate(patch) {
    if (!patch.edges || !patch.nodes) return patch;

    const handleRewrites: Record<string, Record<string, string>> = {
      'sampler~': {
        'audio-in-audio-in': 'audio-in',
        'message-in-message-in': 'message-in',
        'audio-out-audio-out': 'audio-out'
      },
      'expr~': {
        'audio-out-audio-out': 'audio-out'
      },
      'ai.music': {
        'audio-out-audio-out': 'audio-out'
      }
    };

    // Build lookup sets for source (outlet) and target (inlet) nodes
    const nodeTypes = new Map(patch.nodes.map((node) => [node.id, node.type]));

    const migratedEdges = patch.edges.map((edge) => {
      let newEdge = edge;

      // Check source (outlet) handle
      const sourceType = nodeTypes.get(edge.source);
      if (sourceType && handleRewrites[sourceType] && edge.sourceHandle) {
        const newHandle = handleRewrites[sourceType][edge.sourceHandle];
        if (newHandle) {
          newEdge = { ...newEdge, sourceHandle: newHandle };
        }
      }

      // Check target (inlet) handle
      const targetType = nodeTypes.get(edge.target);
      if (targetType && handleRewrites[targetType] && edge.targetHandle) {
        const newHandle = handleRewrites[targetType][edge.targetHandle];
        if (newHandle) {
          newEdge = { ...newEdge, targetHandle: newHandle };
        }
      }

      return newEdge;
    });

    return { ...patch, edges: migratedEdges };
  }
};
