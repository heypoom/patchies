import { MessageQueue, MessageSystem, type MessageCallbackFn } from './MessageSystem';

type SendOptions = { type?: string; to?: string };

export class MessageContext {
	public queue: MessageQueue;
	public messageSystem: MessageSystem;
	public nodeId: string;

	public messageCallback: MessageCallbackFn | null = null;
	private intervals: number[] = [];

	public onSend = (data: any, options: SendOptions = {}) => {};
	public onMessageCallbackRegistered = () => {};
	public onIntervalCallbackRegistered = () => {};

	constructor(nodeId: string) {
		this.nodeId = nodeId;
		this.messageSystem = MessageSystem.getInstance();

		// Register this node with the message system
		this.queue = this.messageSystem.registerNode(nodeId);

		// Set up the onMessage callback forwarding
		this.queue.addCallback(this.messageCallbackHandler.bind(this));
	}

	messageCallbackHandler: MessageCallbackFn = (data, meta) => {
		this.messageCallback?.(data, meta);
	};

	createSendFunction() {
		return this.send.bind(this);
	}

	send(data: unknown, options: SendOptions = {}) {
		this.messageSystem.sendMessage(this.nodeId, data, options);
		this.onSend(data, options);
	}

	// Create the onMessage function for this node
	createOnMessageFunction() {
		return (callback: MessageCallbackFn) => {
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
			this.onIntervalCallbackRegistered();
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
		this.queue.removeCallback(this.messageCallbackHandler.bind(this));

		// Unregister the node
		this.messageSystem.unregisterNode(this.nodeId);

		// Clear callback
		this.messageCallback = null;
	}
}
