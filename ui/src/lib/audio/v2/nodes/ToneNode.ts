import { type AudioNodeV2, type AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { match, P } from 'ts-pattern';
import { MessageContext } from '$lib/messages/MessageContext';

type RecvCallback = (message: unknown, meta: unknown) => void;

type OnSetPortCount = (inletCount: number, outletCount: number) => void;
type OnSetTitle = (title: string) => void;

/**
 * ToneNode implements the tone~ audio node.
 * Executes user-defined Tone.js code for music synthesis and audio processing.
 */
export class ToneNode implements AudioNodeV2 {
	static type = 'tone~';
	static group: AudioNodeGroup = 'processors';
	static description = 'Tone.js synthesis and audio processing node';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Audio signal input'
		},
		{
			name: 'code',
			type: 'string',
			description: 'Tone.js code to execute'
		}
	];

	static outlets: ObjectOutlet[] = [{ name: 'out', type: 'signal', description: 'Audio output' }];

	// Output gain node
	audioNode: GainNode;

	readonly nodeId: string;

	private inputNode: GainNode;
	private audioContext: AudioContext;
	private messageContext: MessageContext;

	private cleanupFn: (() => void) | null = null;
	private recvCallback: RecvCallback | null = null;

	// Dynamic port counts for UI
	private messageInletCount = 0;
	private messageOutletCount = 0;

	public onSetPortCount: OnSetPortCount = () => {};
	public onSetTitle: OnSetTitle = () => {};

	// Node-scoped logger for routing console output to VirtualConsole
	private nodeLogger;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioContext = audioContext;
		this.nodeLogger = logger.ofNode(nodeId);

		// Create gain nodes immediately for connections
		this.audioNode = audioContext.createGain();
		this.audioNode.gain.value = 1.0;

		this.inputNode = audioContext.createGain();
		this.inputNode.gain.value = 1.0;

		this.messageContext = new MessageContext(nodeId);
	}

	async create(params: unknown[]): Promise<void> {
		const [, code] = params as [unknown, string];

		if (code) {
			await this.setCode(code);
		}
	}

	async send(key: string, msg: unknown): Promise<void> {
		return match([key, msg])
			.with(['code', P.string], ([, code]) => {
				return this.setCode(code);
			})
			.with(['messageInlet', P.any], ([, messageData]) => {
				this.handleMessageInlet(messageData);
			})
			.otherwise(() => {
				// Handle other message types if needed
			});
	}

	/**
	 * Handle incoming connections - route to input node
	 */
	connectFrom(source: AudioNodeV2): void {
		if (source.audioNode) {
			source.audioNode.connect(this.inputNode);
		}
	}

	private async ensureTone() {
		const Tone = await import('tone');
		Tone.setContext(this.audioContext);
		return Tone;
	}

	private async setCode(code: string): Promise<void> {
		const Tone = await this.ensureTone();

		if (!code || code.trim() === '') {
			await this.cleanup();
			return;
		}

		try {
			// Clean up any existing objects
			await this.cleanup();

			// Reset message inlet count and recv callback for new code
			this.messageInletCount = 0;
			this.messageOutletCount = 0;
			this.recvCallback = null;

			// Create setPortCount function available in user code
			const setPortCount = (inletCount: number = 0, outletCount: number = 0) => {
				this.messageInletCount = Math.max(0, inletCount);
				this.messageOutletCount = Math.max(0, outletCount);
				this.onSetPortCount(this.messageInletCount, this.messageOutletCount);
			};

			// Create setTitle function available in user code
			const setTitle = (title: string) => {
				this.onSetTitle(title);
			};

			// Create recv function for receiving messages
			const recv = (callback: (message: unknown, meta: unknown) => void) => {
				this.recvCallback = callback;
			};

			// Create send function for sending messages
			const send = (message: unknown, options?: { to?: number }) =>
				this.messageContext.send(message, options);

			// Create outputNode that connects to our gain node
			const outputNode = this.audioNode;
			// Create inputNode that receives incoming audio
			const inputNode = this.inputNode;

			// Create custom console that routes to VirtualConsole
			const customConsole = {
				log: (...args: unknown[]) => this.nodeLogger.log(...args),
				error: (...args: unknown[]) => this.nodeLogger.error(...args),
				warn: (...args: unknown[]) => this.nodeLogger.warn(...args),
				debug: (...args: unknown[]) => this.nodeLogger.debug(...args),
				info: (...args: unknown[]) => this.nodeLogger.info(...args)
			};

			// Execute the Tone.js code with our context
			const codeFunction = new Function(
				'Tone',
				'setPortCount',
				'setTitle',
				'recv',
				'send',
				'outputNode',
				'inputNode',
				'console',
				`

				${code}
			`
			);

			// Execute the code and store any returned cleanup function
			const result = codeFunction(
				Tone,
				setPortCount,
				setTitle,
				recv,
				send,
				outputNode,
				inputNode,
				customConsole
			);

			if (result && typeof result.cleanup === 'function') {
				this.cleanupFn = result.cleanup;
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.nodeLogger.error(errorMessage);
		}
	}

	private handleMessageInlet(messageData: unknown): void {
		if (!this.recvCallback) return;

		try {
			// Type guard to ensure messageData has the expected structure
			if (
				typeof messageData === 'object' &&
				messageData !== null &&
				'message' in messageData &&
				'meta' in messageData
			) {
				const data = messageData as { message: unknown; meta: unknown };
				this.recvCallback(data.message, data.meta);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.nodeLogger.error(`Error in recv(): ${errorMessage}`);
		}
	}

	private async cleanup() {
		const Tone = await this.ensureTone();

		// Call any user-provided cleanup function first
		if (this.cleanupFn) {
			try {
				this.cleanupFn();
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				this.nodeLogger.error(`Error during cleanup: ${errorMessage}`);
			}
		}

		// Stop and clear the transport more safely
		try {
			const transport = Tone.getTransport();

			// Try to stop without parameters
			if (transport.state !== 'stopped') {
				transport.stop();
			}

			try {
				transport.cancel();
			} catch {
				// ignore
			}
		} catch {
			// ignore
		}

		this.cleanupFn = null;
	}

	destroy(): void {
		this.cleanup();
		this.recvCallback = null;
		this.messageContext.destroy();
		this.audioNode.disconnect();
		this.inputNode.disconnect();
	}
}
