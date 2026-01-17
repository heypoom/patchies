import type { Migration } from '../types';

/**
 * Migration 001: MessageNode inlet handle IDs
 *
 * Before: MessageNode had:
 *   - message-in (single inlet for bang/trigger)
 *
 * After: MessageNode uses consistent indexing:
 *   - message-in-1 (hot inlet, bang or $1)
 *   - message-in-2 ($2 inlet, cold) - only if $2 exists
 *   - etc.
 *
 * This migration renames edges targeting message-in to message-in-1
ode targets.
 */
export const migration001: Migration = {
	version: 1,
	name: 'message-node-inlet-indexing',

	migrate(patch) {
		if (!patch.nodes || !patch.edges) return patch;

		// Find all message node IDs (node type is 'msg')
		const messageNodeIds = new Set<string>();

		for (const node of patch.nodes) {
			if (node.type === 'msg') {
				messageNodeIds.add(node.id);
			}
		}

		const migratedEdges = patch.edges.map((edge) => {
			if (messageNodeIds.has(edge.target) && edge.targetHandle === 'message-in') {
				return {
					...edge,
					targetHandle: 'message-in-1',

					// Update edge ID if it contains the handle name
					id: edge.id.replace('message-in', 'message-in-1')
				};
			}

			return edge;
		});

		return {
			...patch,
			edges: migratedEdges
		};
	}
};
