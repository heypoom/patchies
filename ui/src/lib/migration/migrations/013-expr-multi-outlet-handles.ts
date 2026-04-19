import type { Migration } from '../types';

/**
 * Migration 013: expr, expr~, fexpr~ now always use indexed outlet handles.
 *
 * Multi-outlet support (semicolon-separated expressions) switched the outlet
 * handle IDs from bare (`message-out`, `audio-out`) to indexed (`*-out-0`,
 * `*-out-1`, ...). Old patches still reference the bare handles, so their
 * edges silently disconnect.
 */
export const migration013: Migration = {
  version: 13,
  name: 'expr-multi-outlet-handles',

  migrate(patch) {
    if (!patch.edges || !patch.nodes) return patch;

    const handleRewrites: Record<string, Record<string, string>> = {
      expr: {
        'message-out': 'message-out-0'
      },
      'expr~': {
        'audio-out': 'audio-out-0'
      },
      'fexpr~': {
        'audio-out': 'audio-out-0'
      }
    };

    const nodeTypes = new Map(patch.nodes.map((node) => [node.id, node.type]));

    const migratedEdges = patch.edges.map((edge) => {
      let newEdge = edge;

      const sourceType = nodeTypes.get(edge.source);
      if (sourceType && handleRewrites[sourceType] && edge.sourceHandle) {
        const newHandle = handleRewrites[sourceType][edge.sourceHandle];
        if (newHandle) {
          newEdge = { ...newEdge, sourceHandle: newHandle };
        }
      }

      return newEdge;
    });

    return { ...patch, edges: migratedEdges };
  }
};
