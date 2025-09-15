import { match, P } from 'ts-pattern';

export class ToneManager {
	private gainNode: GainNode;
	private inputNode: GainNode;
	private toneObjects: Map<string, unknown> = new Map();
	private recvCallback: ((message: unknown, meta: unknown) => void) | null = null;
	private messageInletCount = 0;
	private currentCode = '';
	private createdNodes: Set<{ dispose?: () => void }> = new Set();
	private audioContext: AudioContext;
	private inletValues: unknown[] = new Array(9).fill(0);

	public onSetPortCount = (inletCount: number) => {};

	constructor(audioContext: AudioContext, gainNode: GainNode, inputNode: GainNode) {
		this.gainNode = gainNode;
		this.inputNode = inputNode;
		this.audioContext = audioContext;
	}

	async handleMessage(key: string, msg: unknown): Promise<void> {
		return match([key, msg])
			.with(['code', P.string], ([, code]) => {
				return this.setCode(code);
			})
			.with(['inletValues', P.array(P.any)], ([, values]) => {
				this.setInletValues(values);
			})
			.with(['messageInlet', P.any], ([, messageData]) => {
				this.handleMessageInlet(messageData);
			})
			.otherwise(() => {
				// Handle other message types if needed
			});
	}

	async ensureTone() {
		const Tone = await import('tone');
		Tone.setContext(this.audioContext);

		return Tone;
	}

	private async setCode(code: string): Promise<void> {
		const Tone = await this.ensureTone();

		if (!code || code.trim() === '') {
			await this.cleanup();
			this.currentCode = '';
			return;
		}

		this.currentCode = code;

		try {
			// Clean up any existing objects
			await this.cleanup();

			// Reset message inlet count and recv callback for new code
			this.messageInletCount = 0;
			this.recvCallback = null;

			// Create setPortCount function available in user code
			const setPortCount = (count: number) => {
				this.messageInletCount = Math.max(0, count);
				this.onSetPortCount(this.messageInletCount);
			};

			// Create recv function for receiving messages
			const recv = (callback: (message: unknown, meta: unknown) => void) => {
				this.recvCallback = callback;
			};

			// Create send function for sending messages
			const send = (message: unknown, options?: { to?: number }) => {
				// TODO: Implement message sending to other nodes
				console.log('Tone~ send:', message, options);
			};

			// Create outputNode that connects to our gain node
			const outputNode = this.gainNode;
			// Create inputNode that receives incoming audio
			const inputNode = this.inputNode;

			// Execute the Tone.js code with our context
			const codeFunction = new Function(
				'Tone',
				'setPortCount',
				'recv',
				'send',
				'outputNode',
				'inputNode',
				'$1',
				'$2',
				'$3',
				'$4',
				'$5',
				'$6',
				'$7',
				'$8',
				'$9',
				`

				${code}
			`
			);

			// Execute the code and store any returned cleanup function
			const result = codeFunction(
				Tone,
				setPortCount,
				recv,
				send,
				outputNode,
				inputNode,
				...this.inletValues
			);

			if (result && typeof result.cleanup === 'function') {
				this.toneObjects.set('cleanup', result.cleanup);
			}
		} catch (error) {
			console.error('Failed to execute Tone.js code:', error);
		}
	}

	private setInletValues(values: unknown[]): void {
		this.inletValues = values;

		// Re-execute code with new inlet values if we have current code
		if (this.currentCode) {
			this.setCode(this.currentCode);
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
			console.error('Error in Tone recv callback:', error);
		}
	}

	private async cleanup() {
		const Tone = await this.ensureTone();

		// Call any user-provided cleanup function first
		const cleanupFn = this.toneObjects.get('cleanup');
		if (cleanupFn && typeof cleanupFn === 'function') {
			try {
				cleanupFn();
			} catch (error) {
				console.error('Error during user cleanup:', error);
			}
		}

		// Dispose all tracked Tone.js objects
		this.createdNodes.forEach((node) => {
			try {
				if (node && typeof node.dispose === 'function') {
					node.dispose();
				}
			} catch (error) {
				console.warn('Error disposing Tone.js object:', error);
			}
		});
		this.createdNodes.clear();

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

		this.toneObjects.clear();
	}

	public destroy(): void {
		this.cleanup();
		this.recvCallback = null;
	}
}
