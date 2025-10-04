import { match, P } from 'ts-pattern';
import { JSRunner } from '$lib/js-runner/JSRunner';
import type WebRenderer from '@elemaudio/web-renderer';
import { MessageContext } from '$lib/messages/MessageContext';

type RecvCallback = (message: unknown, meta: unknown) => void;

export class ElementaryAudioManager {
	private gainNode: GainNode;
	private inputNode: GainNode;
	private audioContext: AudioContext;
	private core: WebRenderer | null = null;
	private workletNode: AudioWorkletNode | null = null;
	private recvCallback: RecvCallback | null = null;
	private messageInletCount = 0;
	private messageOutletCount = 0;
	private jsRunner: JSRunner;
	private nodeId: string;
	private elementaryCore: typeof import('@elemaudio/core') | null = null;
	private messageContext: MessageContext;

	public onSetPortCount = (inletCount: number, outletCount: number) => {};

	constructor(nodeId: string, audioContext: AudioContext, gainNode: GainNode, inputNode: GainNode) {
		this.nodeId = nodeId;
		this.gainNode = gainNode;
		this.inputNode = inputNode;
		this.audioContext = audioContext;
		this.jsRunner = JSRunner.getInstance();
		this.messageContext = new MessageContext(nodeId);
	}

	async handleMessage(key: string, msg: unknown): Promise<void> {
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

	private async ensureElementary() {
		if (!this.elementaryCore) {
			// Lazy load Elementary Audio packages
			const [core, WebRenderer] = await Promise.all([
				import('@elemaudio/core'),
				import('@elemaudio/web-renderer')
			]);

			this.elementaryCore = core;

			// Initialize WebRenderer if not already done
			if (!this.core) {
				const coreInstance = new WebRenderer.default();

				// Initialize the AudioWorkletNode
				// TODO: support multiple inputs and outputs.
				const node = await coreInstance.initialize(this.audioContext, {
					numberOfInputs: 1,
					numberOfOutputs: 1,
					outputChannelCount: [2]
				});

				this.core = coreInstance;
				this.workletNode = node;

				// Connect the worklet node to our audio graph
				this.inputNode.connect(this.workletNode);
				this.workletNode.connect(this.gainNode);
			}
		}

		return this.elementaryCore;
	}

	private async setCode(code: string): Promise<void> {
		if (!code || code.trim() === '') {
			// render silence
			await this.core?.render();
			this.cleanup();

			return;
		}

		this.cleanup();

		try {
			// Ensure Elementary is loaded
			const elementaryCore = await this.ensureElementary();

			if (!this.core || !this.workletNode) {
				throw new Error('Elementary Audio not initialized');
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

			// Preprocess code using JSRunner
			const processedCode = await this.jsRunner.preprocessCode(code, {
				nodeId: this.nodeId,
				setLibraryName: () => {}
			});

			if (!processedCode) {
				console.warn('Code preprocessing returned null');
				return;
			}

			await this.jsRunner.executeJavaScript(this.nodeId, processedCode, {
				setPortCount: (inletCount: number = 0, outletCount: number = 0) => {
					this.messageInletCount = Math.max(0, inletCount);
					this.messageOutletCount = Math.max(0, outletCount);
					this.onSetPortCount(this.messageInletCount, this.messageOutletCount);
				},
				extraContext: {
					el: elementaryCore.el,
					core: this.core,
					node: this.workletNode,
					inputNode: this.inputNode,
					outputNode: this.gainNode,
					recv,
					send
				}
			});
		} catch (error) {
			console.error('Failed to execute Elementary Audio code:', error);
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
			console.error('Error in Elementary recv callback:', error);
		}
	}

	public cleanup(): void {
		this.core?.gc();
		this.core?.pruneVirtualFileSystem();
	}

	public destroy(): void {
		this.core?.render();
		this.cleanup();
		this.messageContext.destroy();

		// Disconnect audio nodes
		if (this.workletNode) {
			try {
				this.inputNode.disconnect(this.workletNode);
				this.workletNode.disconnect(this.gainNode);
			} catch (error) {
				console.warn('Error disconnecting Elementary audio nodes:', error);
			}
		}

		this.recvCallback = null;
		this.jsRunner.destroy(this.nodeId);
	}
}
