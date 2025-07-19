export interface Message {
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

	receiveMessage(message: Message) {
		// Process message immediately
		this.callbacks.forEach(callback => {
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
	private connections = new Map<string, string[]>(); // nodeId -> array of connected nodeIds
	private intervals = new Map<number, NodeJS.Timeout>();
	private intervalCounter = 0;
	private deletedNodes = new Set<string>();

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
		for (const [sourceId, targets] of this.connections.entries()) {
			const index = targets.indexOf(nodeId);
			if (index > -1) {
				targets.splice(index, 1);
			}
		}
	}

	// Update connections based on XY Flow graph
	updateConnections(connections: Array<{ source: string; target: string }>) {
		// Clear existing connections
		this.connections.clear();

		// Build new connection map
		for (const { source, target } of connections) {
			if (!this.connections.has(source)) {
				this.connections.set(source, []);
			}
			this.connections.get(source)!.push(target);
		}
	}

	// Send a message from a node
	sendMessage(fromNodeId: string, data: any, options: { type?: string; outlet?: string } = {}) {
		// Ignore messages from deleted nodes
		if (this.deletedNodes.has(fromNodeId)) {
			return;
		}

		const message: Message = {
			data,
			type: options.type,
			timestamp: Date.now(),
			source: fromNodeId,
			outlet: options.outlet
		};

		// Get connected nodes
		const connectedNodes = this.connections.get(fromNodeId) || [];

		// Send to all connected nodes
		for (const targetNodeId of connectedNodes) {
			const targetQueue = this.messageQueues.get(targetNodeId);
			if (targetQueue) {
				// Set inlet name (for now, assume single inlet)
				const messageWithInlet = { ...message, inlet: 'default' };
				targetQueue.receiveMessage(messageWithInlet);
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

	// Clear all intervals for a node (called during cleanup)
	clearIntervalsForNode(nodeId: string) {
		// For now, we'll clear all intervals when any node is deleted
		// TODO: Track intervals per node for more precise cleanup
		for (const [intervalId, timeout] of this.intervals.entries()) {
			clearInterval(timeout);
		}
		this.intervals.clear();
	}
}