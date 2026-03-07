import type { Migration } from '../types';

/**
 * Migration 010: Convert table text objects to dedicated TableNode visual nodes
 *
 * Before: table nodes were created as generic `object` nodes with:
 *   { type: 'object', data: { expr: 'table myname 512', name: 'table', params: [null, 'myname', 512] } }
 *
 * After: dedicated visual node with:
 *   { type: 'table', data: { bufferName: 'myname', size: 512, showVisual: false } }
 *
 * Handle IDs remain the same (message-in / message-out), so no edge migration needed.
 */
export const migration010: Migration = {
  version: 10,
  name: 'table-to-visual-node',

  migrate(patch) {
    if (!patch.nodes) return patch;

    const migratedNodes = patch.nodes.map((node) => {
      if (node.type !== 'object') return node;

      const data = node.data as { name?: string; params?: unknown[] } | undefined;
      if (data?.name !== 'table') return node;

      const params = Array.isArray(data.params) ? data.params : [];
      // params layout: [null, bufferName, size]
      const bufferName =
        typeof params[1] === 'string' && params[1].length > 0 ? params[1] : node.id;
      const size = typeof params[2] === 'number' && params[2] > 0 ? Math.round(params[2]) : 100;

      return {
        ...node,
        type: 'table',
        data: {
          bufferName,
          size,
          showVisual: false
        }
      };
    });

    return { ...patch, nodes: migratedNodes };
  }
};
