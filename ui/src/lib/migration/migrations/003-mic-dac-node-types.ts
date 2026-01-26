import type { Migration } from '../types';

/**
 * Migration 003: Convert mic~ and dac~ from object type to dedicated node types
 *
 * Before: mic~ and dac~ were created as generic `object` nodes with expr: 'mic~' or 'dac~'
 * After: They have dedicated node types with proper UI and settings
 *
 * This migration:
 * 1. Converts type: 'object' with data.expr: 'mic~' to type: 'mic~'
 * 2. Converts type: 'object' with data.expr: 'dac~' to type: 'dac~'
 * 3. Adds default settings for the new node format
 * 4. Updates edge handles from object format to new format
 */
export const migration003: Migration = {
	version: 3,
	name: 'mic-dac-node-types',

	migrate(patch) {
		if (!patch.nodes) return patch;

		const micDacNodeIds = new Map<string, 'mic~' | 'dac~'>();

		// Convert object nodes with mic~/dac~ expr to dedicated types
		const migratedNodes = patch.nodes.map((node) => {
			if (node.type !== 'object') return node;

			const expr = typeof node.data?.expr === 'string' ? node.data.expr.trim() : null;

			if (expr === 'mic~') {
				micDacNodeIds.set(node.id, 'mic~');
				return {
					...node,
					type: 'mic~',
					data: {
						deviceId: '',
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true
					}
				};
			}

			if (expr === 'dac~') {
				micDacNodeIds.set(node.id, 'dac~');
				return {
					...node,
					type: 'dac~',
					data: {
						deviceId: ''
					}
				};
			}

			return node;
		});

		// Update edge handles for converted nodes
		let migratedEdges = patch.edges;
		if (patch.edges && micDacNodeIds.size > 0) {
			migratedEdges = patch.edges.map((edge) => {
				let newEdge = { ...edge };

				// Handle mic~ as source (outlet)
				if (micDacNodeIds.get(edge.source) === 'mic~') {
					// Old: out-0 or signal-out, New: audio-out-0
					if (
						edge.sourceHandle === 'out-0' ||
						edge.sourceHandle === 'signal-out' ||
						edge.sourceHandle === 'signal-out-0' ||
						edge.sourceHandle === 'audio-out'
					) {
						newEdge = {
							...newEdge,
							sourceHandle: 'audio-out-0'
						};
					}
				}

				// Handle mic~ as target (inlet for bang)
				if (micDacNodeIds.get(edge.target) === 'mic~') {
					// Old: in-0 or message-in, New: message-in-0
					if (
						edge.targetHandle === 'in-0' ||
						edge.targetHandle === 'message-in' ||
						edge.targetHandle === 'message-in-0'
					) {
						newEdge = {
							...newEdge,
							targetHandle: 'message-in-0'
						};
					}
				}

				// Handle dac~ as target (inlet)
				if (micDacNodeIds.get(edge.target) === 'dac~') {
					// Old: in-0, signal-in, etc. New: audio-in-0
					if (
						edge.targetHandle === 'in-0' ||
						edge.targetHandle === 'signal-in' ||
						edge.targetHandle === 'signal-in-0' ||
						edge.targetHandle === 'audio-in'
					) {
						newEdge = {
							...newEdge,
							targetHandle: 'audio-in-0'
						};
					}
				}

				return newEdge;
			});
		}

		return { ...patch, nodes: migratedNodes, edges: migratedEdges };
	}
};
