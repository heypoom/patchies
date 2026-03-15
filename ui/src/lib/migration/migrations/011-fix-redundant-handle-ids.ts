import type { Migration } from '../types';

/**
 * Migration 011: Fix handle IDs changed during StandardHandle → TypedHandle migration
 *
 * Several categories of fixes:
 * 1. Redundant handleId (audio-out-audio-out → audio-out): sampler~, expr~, fexpr~, ai.music
 * 2. Dropped handleId (message-in-0 → message-in): asm.mem, uxn
 * 3. Corrected handleId for csound~ (audio-in → audio-in-0, message-in-0 → message-in-1, audio-out → audio-out-0)
 */
export const migration011: Migration = {
  version: 11,
  name: 'fix-handle-ids',

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
      'fexpr~': {
        'audio-out-audio-out': 'audio-out'
      },
      'ai.music': {
        'audio-out-audio-out': 'audio-out'
      },
      'asm.mem': {
        'message-in-0': 'message-in',
        'message-out-0': 'message-out'
      },
      uxn: {
        'message-in-0': 'message-in',
        'message-out-0': 'message-out'
      },
      'csound~': {
        'audio-in': 'audio-in-0',
        'message-in-0': 'message-in-1',
        'audio-out': 'audio-out-0'
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
