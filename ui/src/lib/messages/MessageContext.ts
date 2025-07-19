import { MessageSystem, type MessageCallback } from './MessageSystem';

export class MessageContext {
	private messageSystem: MessageSystem;
	private nodeId: string;
	private intervals: number[] = [];
	private messageCallback: MessageCallback | null = null;

	constructor(nodeId: string) {
		this.nodeId = nodeId;
		this.messageSystem = MessageSystem.getInstance();

		// Register this node with the message system
		const queue = this.messageSystem.registerNode(nodeId);

		// Set up the onMessage callback forwarding
		queue.addCallback((message) => {
			if (this.messageCallback) {
				this.messageCallback(message);
			}
		});
	}

	// Create the send function for this node
	createSendFunction() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (data: any, options: { type?: string; outlet?: string } = {}) => {
			this.messageSystem.sendMessage(this.nodeId, data, options);
		};
	}

	// Create the onMessage function for this node
	createOnMessageFunction() {
		return (callback: MessageCallback) => {
			// Always update the callback - this allows re-registering
			this.messageCallback = callback;
		};
	}

	// Create the interval function for this node
	createIntervalFunction() {
		return (callback: () => void, ms: number) => {
			const intervalId = this.messageSystem.createInterval(callback, ms);
			this.intervals.push(intervalId);
			return intervalId;
		};
	}

	// Get all the context functions to inject
	getContext() {
		return {
			send: this.createSendFunction(),
			onMessage: this.createOnMessageFunction(),
			interval: this.createIntervalFunction()
		};
	}

	// Clear only intervals (for code re-execution)
	clearIntervals() {
		// Clear all intervals created by this node
		for (const intervalId of this.intervals) {
			this.messageSystem.clearInterval(intervalId);
		}
		this.intervals = [];
	}

	// Clean up when the node is destroyed
	destroy() {
		this.clearIntervals();

		// Unregister the node
		this.messageSystem.unregisterNode(this.nodeId);

		// Clear callback
		this.messageCallback = null;
	}
}
