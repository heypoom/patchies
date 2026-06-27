import { GM_DEFAULT_SETTINGS, GM_SETTINGS_SCHEMA } from '$objects/smplr/gm-settings';
import type { Migration } from '../types';

/**
 * Migration 015: Convert gm~ text objects to the dedicated visual GM node.
 *
 * Early gm~ patches could contain a generic `object` node with:
 *   { type: 'object', data: { expr: 'gm~', name: 'gm~', params: [] } }
 *
 * The dedicated node renders the 16-channel monitor and owns its settings in
 * node data, so old generic gm~ objects need to become type `gm~`.
 */
export const migration015: Migration = {
  version: 15,
  name: 'gm-to-ui-node',

  migrate(patch) {
    if (!patch.nodes) return patch;

    const migratedNodeIds = new Set<string>();

    const migratedNodes = patch.nodes.map((node) => {
      if (node.type !== 'object') return node;

      const data = node.data as { expr?: string; name?: string } | undefined;
      const exprName = typeof data?.expr === 'string' ? data.expr.trim().split(/\s+/)[0] : '';
      if (data?.name !== 'gm~' && exprName !== 'gm~') return node;

      migratedNodeIds.add(node.id);

      return {
        ...node,
        type: 'gm~',
        data: {
          settings: structuredClone(GM_DEFAULT_SETTINGS),
          settingsSchema: GM_SETTINGS_SCHEMA
        }
      };
    });

    const migratedEdges = patch.edges?.map((edge) => {
      let nextEdge = edge;

      if (migratedNodeIds.has(edge.target)) {
        nextEdge = {
          ...nextEdge,
          targetHandle: rewriteGmInletHandle(edge.targetHandle)
        };
      }

      if (migratedNodeIds.has(edge.source)) {
        nextEdge = {
          ...nextEdge,
          sourceHandle: rewriteGmOutletHandle(edge.sourceHandle)
        };
      }

      return nextEdge;
    });

    return { ...patch, nodes: migratedNodes, edges: migratedEdges };
  }
};

function rewriteGmInletHandle(handle: string | null | undefined): string | null | undefined {
  if (handle === 'message-in-0') return 'message-in';

  return handle;
}

function rewriteGmOutletHandle(handle: string | null | undefined): string | null | undefined {
  if (handle === 'audio-out-0' || handle === 'signal-out-0') return 'audio-out';

  return handle;
}
