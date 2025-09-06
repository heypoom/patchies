import { AudioAnalysisSystem, type AudioAnalysisProps } from '$lib/audio/AudioAnalysisSystem';
import { FFTAnalysis } from '$lib/audio/FFTAnalysis';
import { MessageQueue, MessageSystem, type MessageCallbackFn } from './MessageSystem';

export type SendMessageOptions = {
	/**
	 * Which outlet to send the message to?
	 * Number refers to the outlet index.
	 */
	to?: number;
};

export interface UserFnRunContext {
	/** Sends messages. */
	send: (data: unknown, options?: SendMessageOptions) => void;

	/** Receives messages. */
	onMessage: (callback: MessageCallbackFn) => void;

	/** Schedules setInterval with cleanup. */
	setInterval: (callback: () => void, ms: number) => number;

	/** Disables dragging in canvas. */
	noDrag: () => void;

	/** Get audio analysis data */
	fft: (options: AudioAnalysisProps) => FFTAnalysis;

	/** Sets the number of inlets and outlets for the node. */
	setPortCount?: (inletCount?: number, outletCount?: number) => void;
}

export class MessageContext {
	public queue: MessageQueue;
	public messageSystem: MessageSystem;
	public nodeId: string;
	public audioAnalysis: AudioAnalysisSystem;

	public messageCallback: MessageCallbackFn | null = null;
	private intervals: number[] = [];

	public onSend: UserFnRunContext['send'] = () => {};
	public onMessageCallbackRegistered = () => {};
	public onIntervalCallbackRegistered = () => {};

	constructor(nodeId: string) {
		this.nodeId = nodeId;
		this.messageSystem = MessageSystem.getInstance();
		this.audioAnalysis = AudioAnalysisSystem.getInstance();

		// Register this node with the message system
		this.queue = this.messageSystem.registerNode(nodeId);

		// Set up the onMessage callback forwarding
		this.queue.addCallback(this.messageCallbackHandler.bind(this));
	}

	messageCallbackHandler: MessageCallbackFn = (data, meta) => {
		this.messageCallback?.(data, meta);
	};

	send(data: unknown, options: SendMessageOptions = {}) {
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
	createSetIntervalFunction() {
		return (callback: () => void, ms: number) => {
			const intervalId = this.messageSystem.createInterval(callback, ms);
			this.intervals.push(intervalId);
			this.onIntervalCallbackRegistered();
			return intervalId;
		};
	}

	// Create an fft function that automatically infers connected FFT nodes
	createFFTFunction() {
		return (options: AudioAnalysisProps) => {
			const bins = this.audioAnalysis.getAnalysisForNode(this.nodeId, options);
			const sampleRate = this.audioAnalysis.sampleRate;

			return new FFTAnalysis(bins, options?.format ?? null, sampleRate);
		};
	}

	// Get all the context functions to inject
	getContext(): UserFnRunContext {
		return {
			send: this.send.bind(this),
			onMessage: this.createOnMessageFunction(),
			setInterval: this.createSetIntervalFunction(),
			noDrag: () => {},
			fft: this.createFFTFunction()
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
