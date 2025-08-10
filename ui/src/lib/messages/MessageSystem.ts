import type { Edge } from '@xyflow/svelte';
import type { SendMessageOptions } from './MessageContext';

export interface Message<T = unknown> {
	data: T;
	source: string;

	outlet?: number;
	outletId?: string;

	inlet?: number;
	inletId?: string;
}

export type MessageCallbackFn = (data: Message['data'], meta: Omit<Message, 'data'>) => void;

export class MessageQueue {
	private callbacks: MessageCallbackFn[] = [];
	private nodeId: string;

	constructor(nodeId: string) {
		this.nodeId = nodeId;
	}

	addCallback(callback: MessageCallbackFn) {
		this.callbacks.push(callback);
	}

	removeCallback(callback: MessageCallbackFn) {
		const index = this.callbacks.indexOf(callback);

		if (index > -1) {
			this.callbacks.splice(index, 1);
		}
	}

	sendMessage(message: Message) {
		this.callbacks.forEach((callback) => {
			try {
				callback(message['data'], message);
			} catch (error) {
				console.error(`Error in message callback for node ${this.nodeId}:`, error);
				// TODO: Show visual error indicator on the node
			}
		});
	}

	clear() {
		this.callbacks = [];
	}
}

export class MessageSystem {
	private static instance: MessageSystem | null = null;
	private messageQueues = new Map<string, MessageQueue>();
	private intervals = new Map<number, ReturnType<typeof setInterval>>();
	private intervalCounter = 0;
	private deletedNodes = new Set<string>();

	private edges: Edge[] = [];

	// Legacy
	private connections = new Map<string, string[]>(); // nodeId -> array of connected nodeIds

	static getInstance(): MessageSystem {
		if (!MessageSystem.instance) {
			MessageSystem.instance = new MessageSystem();
		}

		return MessageSystem.instance;
	}

	// Register a node for message handling
	registerNode(nodeId: string): MessageQueue {
		if (!this.messageQueues.has(nodeId)) {
			this.messageQueues.set(nodeId, new MessageQueue(nodeId));
		}

		this.deletedNodes.delete(nodeId);
		return this.messageQueues.get(nodeId)!;
	}

	// Unregister a node and clean up
	unregisterNode(nodeId: string) {
		this.deletedNodes.add(nodeId);

		// Clear message queue
		const queue = this.messageQueues.get(nodeId);
		if (queue) {
			queue.clear();
			this.messageQueues.delete(nodeId);
		}

		// Remove connections
		this.connections.delete(nodeId);

		// Remove incoming connections to this node
		for (const [, targets] of this.connections.entries()) {
			const index = targets.indexOf(nodeId);

			if (index > -1) {
				targets.splice(index, 1);
			}
		}
	}

	// Update connections based on XY Flow graph
	updateEdges(edges: Edge[]) {
		this.edges = edges;

		// Clear existing connections
		this.connections.clear();

		// Build new connection map
		for (const edge of edges) {
			if (!this.connections.has(edge.source)) {
				this.connections.set(edge.source, []);
			}

			this.connections.get(edge.source)!.push(edge.target);
		}
	}

	// Send a message from a node
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	sendMessage(fromNodeId: string, data: any, options: SendMessageOptions = {}) {
		// Ignore messages from deleted nodes
		if (this.deletedNodes.has(fromNodeId)) {
			return;
		}

		const message: Message = { data, source: fromNodeId };

		// Get connected nodes
		const connectedNodes = this.connections.get(fromNodeId) || [];
		console.log(`sending message`, { connectedNodes, message });

		// Send to all connected nodes
		for (const targetNodeId of connectedNodes) {
			const targetQueue = this.messageQueues.get(targetNodeId);
			if (!targetQueue) continue;

			const edges = this.edges.filter(
				(edge) => edge.source === fromNodeId && edge.target === targetNodeId
			);

			for (const edge of edges) {
				const outletId = edge.sourceHandle ?? undefined;
				const inletId = edge.targetHandle ?? undefined;

				const outlet = getHandleId(outletId);
				const inlet = getHandleId(inletId);

				// do not send message if the outlet mismatches
				if (typeof options.to === 'number' && outlet !== options.to) {
					continue;
				}

				// do not send message if the outlet id mismatches
				if (typeof options.to === 'string' && outletId !== options.to) {
					continue;
				}

				targetQueue.sendMessage({
					...message,
					outlet,
					inlet,
					outletId,
					inletId
				});
			}
		}
	}

	// Create an interval with automatic cleanup
	createInterval(callback: () => void, ms: number): number {
		const intervalId = this.intervalCounter++;
		const timeout = setInterval(callback, ms);
		this.intervals.set(intervalId, timeout);

		return intervalId;
	}

	// Clear an interval
	clearInterval(intervalId: number) {
		const timeout = this.intervals.get(intervalId);

		if (timeout !== undefined) {
			clearInterval(timeout);
			this.intervals.delete(intervalId);
		}
	}
}

export const getHandleId = (handle?: string) => {
	const m = handle?.match(/.*-(\d)/)?.[1];
	if (m === undefined) return;

	const id = parseInt(m);

	return isNaN(id) ? undefined : id;
};
