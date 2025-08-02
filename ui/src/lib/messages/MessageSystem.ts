import type { Edge } from '@xyflow/svelte';

export interface Message {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: any;
	type?: string;
	timestamp: number;
	source: string;
	outlet?: string;
	inlet?: string;
}

export interface MessageCallback {
	(message: Message): void;
}

export class MessageQueue {
	private callbacks: MessageCallback[] = [];
	private nodeId: string;

	constructor(nodeId: string) {
		this.nodeId = nodeId;
	}

	addCallback(callback: MessageCallback) {
		this.callbacks.push(callback);
	}

	removeCallback(callback: MessageCallback) {
		const index = this.callbacks.indexOf(callback);
		if (index > -1) {
			this.callbacks.splice(index, 1);
		}
	}

	sendMessage(message: Message) {
		// Process message immediately
		this.callbacks.forEach((callback) => {
			try {
				callback(message);
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
	private intervals = new Map<number, number>();
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
		// Remove from deleted nodes if it was re-created
		this.deletedNodes.delete(nodeId);
		return this.messageQueues.get(nodeId)!;
	}

	// Unregister a node and clean up
	unregisterNode(nodeId: string) {
		// Mark as deleted
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
	sendMessage(fromNodeId: string, data: any, options: { type?: string; to?: string } = {}) {
		// Ignore messages from deleted nodes
		if (this.deletedNodes.has(fromNodeId)) {
			return;
		}

		console.log(
			`[MessageSystem] Sending message from ${fromNodeId} to ${options.to ?? 'all connected nodes'}`,
			data
		);

		const message: Message = {
			data,
			type: options.type,
			timestamp: Date.now(),
			source: fromNodeId,
			outlet: options.to
		};

		// Get connected nodes
		const connectedNodes = this.connections.get(fromNodeId) || [];

		// Send to all connected nodes
		for (const targetNodeId of connectedNodes) {
			const targetQueue = this.messageQueues.get(targetNodeId);

			if (targetQueue) {
				// TODO: send all inlets
				// TODO: optimize performance by using connections instead
				const stEdge = this.edges.find(
					(edge) => edge.source === fromNodeId && edge.target === targetNodeId
				);

				const inlet = stEdge?.targetHandle ?? 'default';

				targetQueue.sendMessage({ ...message, inlet });
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
		if (timeout) {
			clearInterval(timeout);
			this.intervals.delete(intervalId);
		}
	}
}
