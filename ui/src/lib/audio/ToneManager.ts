import * as Tone from 'tone';
import { match, P } from 'ts-pattern';

export class ToneManager {
	private gainNode: GainNode;
	private toneObjects: Map<string, unknown> = new Map();
	private recvCallback: ((message: unknown, meta: unknown) => void) | null = null;
	private messageInletCount = 0;
	private currentCode = '';
	private createdNodes: Set<{ dispose?: () => void }> = new Set();

	constructor(audioContext: AudioContext, gainNode: GainNode) {
		this.gainNode = gainNode;
		
		// Set Tone.js to use our audio context
		Tone.setContext(audioContext);
	}

	async handleMessage(key: string, msg: unknown): Promise<void> {
		return match([key, msg])
			.with(['code', P.string], ([, code]) => {
				this.setCode(code);
			})
			.with(['messageInlet', P.any], ([, messageData]) => {
				this.handleMessageInlet(messageData);
			})
			.otherwise(() => {
				// Handle other message types if needed
			});
	}

	private setCode(code: string): void {
		if (!code || code.trim() === '') {
			this.cleanup();
			this.currentCode = '';
			return;
		}

		this.currentCode = code;

		try {
			// Clean up any existing objects
			this.cleanup();

			// Reset message inlet count and recv callback for new code
			this.messageInletCount = 0;
			this.recvCallback = null;

			// Create setPortCount function available in user code
			const setPortCount = (count: number) => {
				this.messageInletCount = Math.max(0, count);
				// TODO: Notify AudioSystem about port count change
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

			// Create a Tone proxy that intercepts constructor calls
			const ToneWrapper = new Proxy(Tone, {
				get: (target, prop) => {
					const value = target[prop as keyof typeof Tone];
					
					// Check if it's a constructor function by checking if it has a prototype with dispose
					if (typeof value === 'function' && 
						value.prototype && 
						typeof value.prototype.dispose === 'function') {
						
						// Return a wrapped constructor that tracks instances
						return (...args: unknown[]) => {
							const instance = new (value as new (...args: unknown[]) => { dispose?: () => void })(...args);
							this.createdNodes.add(instance);
							return instance;
						};
					}
					
					return value;
				}
			});

			// Execute the Tone.js code with our context
			const codeFunction = new Function(
				'Tone',
				'setPortCount',
				'recv',
				'send',
				'outputNode',
				code
			);

			// Execute the code and store any returned cleanup function
			const result = codeFunction(ToneWrapper, setPortCount, recv, send, outputNode);
			
			if (result && typeof result.cleanup === 'function') {
				this.toneObjects.set('cleanup', result.cleanup);
			}

		} catch (error) {
			console.error('Failed to execute Tone.js code:', error);
		}
	}

	private handleMessageInlet(messageData: unknown): void {
		if (!this.recvCallback) return;

		try {
			// Type guard to ensure messageData has the expected structure
			if (typeof messageData === 'object' && 
				messageData !== null && 
				'message' in messageData && 
				'meta' in messageData) {
				const data = messageData as { message: unknown; meta: unknown };
				this.recvCallback(data.message, data.meta);
			}
		} catch (error) {
			console.error('Error in Tone recv callback:', error);
		}
	}

	private cleanup(): void {
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

		// Stop and clear the transport
		try {
			Tone.getTransport().stop();
			Tone.getTransport().cancel();
		} catch (error) {
			console.warn('Error stopping Tone.js transport:', error);
		}

		this.toneObjects.clear();
	}

	public destroy(): void {
		this.cleanup();
		this.recvCallback = null;
	}
}