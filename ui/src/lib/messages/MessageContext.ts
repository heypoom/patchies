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

	/** Schedules requestAnimationFrame with cleanup. */
	requestAnimationFrame: (callback: () => void) => number;

	/** Disables dragging in canvas. */
	noDrag: () => void;

	/** Get audio analysis data */
	fft?: (options: AudioAnalysisProps) => FFTAnalysis;

	/** Sets the number of inlets and outlets for the node. */
	setPortCount?: (inletCount?: number, outletCount?: number) => void;

	/** Sets the title of the node. */
	setTitle?: (title: string) => void;
}

export class MessageContext {
	public queue: MessageQueue;
	public messageSystem: MessageSystem;
	public nodeId: string;

	public messageCallback: MessageCallbackFn | null = null;
	private intervals: number[] = [];
	private animationFrames: number[] = [];

	public onSend: UserFnRunContext['send'] = () => {};
	public onMessageCallbackRegistered = () => {};
	public onIntervalCallbackRegistered = () => {};
	public onAnimationFrameCallbackRegistered = () => {};

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

	// Create the requestAnimationFrame function for this node
	createRequestAnimationFrameFunction() {
		return (callback: () => void) => {
			const animationFrameId = this.messageSystem.createAnimationFrame(callback);
			this.animationFrames.push(animationFrameId);
			this.onAnimationFrameCallbackRegistered();
			return animationFrameId;
		};
	}

	// Create an fft function that automatically infers connected FFT nodes
	createFFTFunction() {
		if (typeof window === 'undefined') return null;

		return (options: AudioAnalysisProps) => {
			const audioAnalysis = AudioAnalysisSystem.getInstance();
			const bins = audioAnalysis.getAnalysisForNode(this.nodeId, options);
			const sampleRate = audioAnalysis.sampleRate;

			return new FFTAnalysis(bins, options?.format ?? null, sampleRate);
		};
	}

	// Get all the context functions to inject
	getContext(): UserFnRunContext {
		const fft = this.createFFTFunction();

		return {
			send: this.send.bind(this),
			onMessage: this.createOnMessageFunction(),
			setInterval: this.createSetIntervalFunction(),
			requestAnimationFrame: this.createRequestAnimationFrameFunction(),
			noDrag: () => {},
			...(fft && { fft })
		};
	}

	// Clear all timers (intervals and animation frames) for code re-execution
	clearTimers() {
		// Clear all intervals created by this node
		for (const intervalId of this.intervals) {
			this.messageSystem.clearInterval(intervalId);
		}

		this.intervals = [];

		// Clear all animation frames created by this node
		for (const animationFrameId of this.animationFrames) {
			this.messageSystem.clearAnimationFrame(animationFrameId);
		}

		this.animationFrames = [];
	}

	// Clear only animation frames (for code re-execution)
	clearAnimationFrames() {
		// Clear all animation frames created by this node
		for (const animationFrameId of this.animationFrames) {
			this.messageSystem.clearAnimationFrame(animationFrameId);
		}

		this.animationFrames = [];
	}

	// Clean up when the node is destroyed
	destroy() {
		this.clearTimers();
		this.queue.removeCallback(this.messageCallbackHandler.bind(this));

		// Unregister the node
		this.messageSystem.unregisterNode(this.nodeId);

		// Clear callback
		this.messageCallback = null;
	}
}
