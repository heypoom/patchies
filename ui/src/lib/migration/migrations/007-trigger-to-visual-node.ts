import { isValidMessageType } from '$lib/messages/message-types';
import type { Migration } from '../types';

/**
 * Migration 007: Convert trigger/t text objects to visual TriggerNode
 *
 * This migration transforms object nodes with expr 'trigger ...' or 't ...'
 * into dedicated visual trigger nodes with proper data structure.
 *
 * Changes:
 * 1. Converts type: 'object' with name 'trigger' or 't' to type: 'trigger'
 * 2. Parses type specifiers from params into types array
 * 3. Sets shorthand flag based on whether 't' or 'trigger' was used
 * 4. Edge inlet handles are updated from 'message-in-0' to 'message-in'
 *    (outlet handles remain 'message-out-N' unchanged)
 */
export const migration007: Migration = {
  version: 7,
  name: 'trigger-to-visual-node',

  migrate(patch) {
    if (!patch.nodes) return patch;

    // Track which nodes are being migrated for edge updates
    const migratedNodeIds = new Set<string>();

    const migratedNodes = patch.nodes.map((node) => {
      // Only migrate object nodes with trigger or t name
      if (node.type !== 'object') return node;

      const data = node.data as { expr?: string; name?: string; params?: unknown[] } | undefined;
      if (!data?.name) return node;

      const name = data.name.toLowerCase();
      if (name !== 'trigger' && name !== 't') return node;

      // Parse type specifiers from expr (e.g. "t b n" → ['b', 'n'])
      // params aren't pre-parsed, so we split expr and skip the object name
      const exprParts = (data.expr || '').trim().split(/\s+/).slice(1);
      const types = exprParts.filter((t) => isValidMessageType(t));

      // Default to two bang outlets if no types specified
      const finalTypes = types.length > 0 ? types : ['b', 'b'];

      migratedNodeIds.add(node.id);

      return {
        ...node,
        type: 'trigger',
        data: {
          types: finalTypes,
          shorthand: name === 't',
          showHelp: false
        }
      };
    });

    // Update edges for migrated nodes
    // Inlet: 'message-in-0' → 'message-in' (TriggerNode has single inlet without id)
    // Outlets: 'message-out-N' → 'message-out-N' (no change needed)
    const migratedEdges = patch.edges?.map((edge) => {
      // Only need to update inlet handles (target)
      // Outlet handles remain the same format
      if (!migratedNodeIds.has(edge.target)) {
        return edge;
      }

      const oldHandle = edge.targetHandle || '';

      // Convert 'message-in-0' to 'message-in'
      if (oldHandle === 'message-in-0') {
        return { ...edge, targetHandle: 'message-in' };
      }

      return edge;
    });

    return {
      ...patch,
      nodes: migratedNodes,
      edges: migratedEdges
    };
  }
};
