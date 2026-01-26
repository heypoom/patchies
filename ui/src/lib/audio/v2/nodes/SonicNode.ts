import { type AudioNodeV2, type AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { logger } from '$lib/utils/logger';
import { createCustomConsole } from '$lib/utils/createCustomConsole';
import { handleCodeError } from '$lib/js-runner/handleCodeError';
import { match, P } from 'ts-pattern';
import { MessageContext } from '$lib/messages/MessageContext';
import { JSRunner } from '$lib/js-runner/JSRunner';
import { SuperSonicManager } from '$lib/audio/SuperSonicManager';
import { SONIC_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';

type RecvCallback = (message: unknown, meta: unknown) => void;
type OnSetPortCount = (inletCount: number, outletCount: number) => void;
type OnSetTitle = (title: string) => void;

/**
 * SonicNode implements the sonic~ audio node.
 * Executes user-defined SuperSonic (SuperCollider scsynth) code for synthesis and audio processing.
 */
export class SonicNode implements AudioNodeV2 {
	static type = 'sonic~';
	static group: AudioNodeGroup = 'processors';
	static description = 'Supersonic is SuperCollider engine for the web';

	static inlets: ObjectInlet[] = [
		{
			name: 'in',
			type: 'signal',
			description: 'Audio signal input'
		},
		{
			name: 'code',
			type: 'string',
			description: 'SuperSonic code to execute'
		}
	];

	static outlets: ObjectOutlet[] = [{ name: 'out', type: 'signal', description: 'Audio output' }];

	// Output gain node
	audioNode: GainNode;

	readonly nodeId: string;

	private inputNode: GainNode;
	private audioContext: AudioContext;
	private messageContext: MessageContext;
	private jsRunner: JSRunner;

	// SuperSonic state
	private isAudioConnected = false;
	private recvCallback: RecvCallback | null = null;

	// Dynamic port counts for UI
	private messageInletCount = 0;
	private messageOutletCount = 0;

	public onSetPortCount: OnSetPortCount = () => {};
	public onSetTitle: OnSetTitle = () => {};

	// Custom console for routing output to VirtualConsole
	private customConsole;

	constructor(nodeId: string, audioContext: AudioContext) {
		this.nodeId = nodeId;
		this.audioContext = audioContext;
		this.customConsole = createCustomConsole(nodeId);

		// Create gain nodes immediately for connections
		this.audioNode = audioContext.createGain();
		this.audioNode.gain.value = 1.0;

		this.inputNode = audioContext.createGain();
		this.inputNode.gain.value = 1.0;

		this.messageContext = new MessageContext(nodeId);
		this.jsRunner = JSRunner.getInstance();
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
			.otherwise(() => {});
	}

	/**
	 * Handle incoming connections - route to input node
	 */
	connectFrom(source: AudioNodeV2): void {
		if (source.audioNode) {
			source.audioNode.connect(this.inputNode);
		}
	}

	private async setCode(code: string): Promise<void> {
		if (!code || code.trim() === '') {
			// Handle empty code
			return;
		}

		try {
			// Lazy load SuperSonic ONLY when code is executed
			const manager = SuperSonicManager.getInstance();

			const { sonic, SuperSonic } = await manager.ensureSuperSonic(this.audioContext);

			// First time setup: Connect audio routing
			if (!this.isAudioConnected) {
				// Connect our input TO SuperSonic's input
				this.inputNode.connect(sonic.node.input);

				// Connect SuperSonic's output TO our output
				sonic.node.connect(this.audioNode);

				this.isAudioConnected = true;
				logger.log('SuperSonic audio routing connected');
			}

			// Reset message inlet count and recv callback for new code
			this.messageInletCount = 0;
			this.messageOutletCount = 0;
			this.recvCallback = null;

			// Create recv function for receiving messages
			const recv = (callback: (message: unknown, meta: unknown) => void) => {
				this.recvCallback = callback;
			};

			// Create send function for sending messages
			const send = (message: unknown, options?: { to?: number }) =>
				this.messageContext.send(message, options);

			// Create event subscription function
			// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
			const on = (event: string, callback: Function) => sonic.on(event, callback);

			// Preprocess code using JSRunner
			const processedCode = await this.jsRunner.preprocessCode(code, { nodeId: this.nodeId });

			if (!processedCode) {
				logger.warn('code preprocessing returned null');
				return;
			}

			await this.jsRunner.executeJavaScript(this.nodeId, processedCode, {
				customConsole: this.customConsole,
				setPortCount: (inletCount: number = 0, outletCount: number = 0) => {
					this.messageInletCount = Math.max(0, inletCount);
					this.messageOutletCount = Math.max(0, outletCount);
					this.onSetPortCount(this.messageInletCount, this.messageOutletCount);
				},
				setTitle: (title: string) => {
					this.onSetTitle(title);
				},
				extraContext: {
					sonic,
					SuperSonic,
					sonicNode: sonic.node,
					on,
					inputNode: this.inputNode,
					outputNode: this.audioNode,
					recv,
					send
				}
			});
		} catch (error) {
			handleCodeError(error, code, this.nodeId, this.customConsole, SONIC_WRAPPER_OFFSET);
		}
	}

	private handleMessageInlet(message: unknown): void {
		if (!this.recvCallback) return;

		try {
			// Type guard to ensure messageData has the expected structure
			if (
				typeof message === 'object' &&
				message !== null &&
				'message' in message &&
				'meta' in message
			) {
				const data = message as { message: unknown; meta: unknown };

				this.recvCallback(data.message, data.meta);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.customConsole.error(`Error in recv(): ${errorMessage}`);
		}
	}

	destroy(): void {
		this.recvCallback = null;

		this.messageContext.destroy();
		this.jsRunner.destroy(this.nodeId);

		// Disconnect audio nodes
		if (this.isAudioConnected) {
			try {
				this.inputNode.disconnect();
			} catch (error) {
				logger.warn('cannot disconnect sonic~ input node:', error);
			}
		}

		this.audioNode.disconnect();
	}
}
