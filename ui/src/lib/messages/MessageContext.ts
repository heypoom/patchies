import { MessageQueue, MessageSystem, type MessageCallback } from './MessageSystem';

type SendOptions = { type?: string; to?: string };

export class MessageContext {
	public queue: MessageQueue;
	public messageSystem: MessageSystem;
	public nodeId: string;

	private intervals: number[] = [];
	private messageCallback: MessageCallback | null = null;

	public onSend = (data: any, options: SendOptions = {}) => {};
	public onMessageCallbackRegistered = () => {};

	constructor(nodeId: string) {
		this.nodeId = nodeId;
		this.messageSystem = MessageSystem.getInstance();

		// Register this node with the message system
		this.queue = this.messageSystem.registerNode(nodeId);

		// Set up the onMessage callback forwarding
		this.queue.addCallback((message) => {
			if (this.messageCallback) {
				this.messageCallback(message);
			}
		});
	}

	// Create the send function for this node
	createSendFunction() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (data: any, options: SendOptions = {}) => {
			this.messageSystem.sendMessage(this.nodeId, data, options);
			this.onSend(data, options);
		};
	}

	// Create the onMessage function for this node
	createOnMessageFunction() {
		return (callback: MessageCallback) => {
			// Always update the callback - this allows re-registering
			this.messageCallback = callback;
			this.onMessageCallbackRegistered();
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
