import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { match, P } from 'ts-pattern';

type DspMessage =
	| { type: 'set-code'; code: string }
	| { type: 'set-inlet-values'; values: number[] }
	| { type: 'message-inlet'; message: unknown; meta: RecvMeta }
	| { type: 'stop' };

type RecvMeta = {
	source: string;
	outlet?: number;
	inlet?: number;
	inletKey?: string;
	outletKey?: string;
};

type ProcessFunction = (
	inputs: Float32Array[][],
	outputs: Float32Array[][],
	inlets: unknown[],
	counter: number
) => void;

class DSPProcessor extends AudioWorkletProcessor {
	private processFunction: ProcessFunction | null = null;
	private inletValues: unknown[] = new Array(10).fill(0);
	private counter = 0;
	private messageInletCount = 0;
	private messageOutletCount = 0;
	private audioInletCount = 1;
	private audioOutletCount = 1;
	private recvCallback: ((message: unknown, meta: RecvMeta) => void) | null = null;
	private shouldStop = false;

	constructor() {
		super();

		this.port.onmessage = (event: MessageEvent<DspMessage>) => {
			match(event.data)
				.with({ type: 'set-code', code: P.string }, ({ code }) => {
					this.setCode(code);
				})
				.with({ type: 'set-inlet-values', values: P.array(P.any) }, ({ values }) => {
					this.setInletValues(values);
				})
				.with({ type: 'message-inlet', message: P.any, meta: P.any }, ({ message, meta }) => {
					this.handleMessageInlet(message, meta);
				})
				.with({ type: 'stop' }, () => {
					this.shouldStop = true;
				});
		};
	}

	private setCode(code: string): void {
		if (!code || code.trim() === '') {
			this.processFunction = null;
			return;
		}

		this.shouldStop = false;

		try {
			// Reset count and recv callback for new code
			this.messageInletCount = 0;
			this.messageOutletCount = 0;
			this.audioInletCount = 1;
			this.audioOutletCount = 1;

			this.recvCallback = null;

			const setPortCount = (inlets = 0, outlets = 0) => {
				this.messageInletCount = Math.max(0, inlets);
				this.messageOutletCount = Math.max(0, outlets);

				this.port.postMessage({
					type: 'message-port-count-changed',
					messageInletCount: this.messageInletCount,
					messageOutletCount: this.messageOutletCount
				});
			};

			const setAudioPortCount = (inlets = 1, outlets = 1) => {
				this.audioInletCount = Math.max(0, inlets);
				this.audioOutletCount = Math.max(0, outlets);

				this.port.postMessage({
					type: 'audio-port-count-changed',
					audioInletCount: this.audioInletCount,
					audioOutletCount: this.audioOutletCount
				});
			};

			// Create setPortCount function that will be available in user code
			const send = (message: unknown, options?: SendMessageOptions) =>
				this.port.postMessage({
					type: 'send-message',
					message,
					options
				});

			const setTitle = (value: string) =>
				this.port.postMessage({
					type: 'set-title',
					value
				});

			const recv = (callback: (message: unknown, meta: RecvMeta) => void) => {
				this.recvCallback = callback;
			};

			const createProcessorFn = new Function(
				'setPortCount',
				'setAudioPortCount',
				'setTitle',
				'recv',
				'send',
				`
				var $1, $2, $3, $4, $5, $6, $7, $8, $9;

				${code}
				
				return (
					inputs,
					outputs,
					inlets,
					counter
				) => {
					$1 = inlets[0];
					$2 = inlets[1];
					$3 = inlets[2];
					$4 = inlets[3];
					$5 = inlets[4];
					$6 = inlets[5];
					$7 = inlets[6];
					$8 = inlets[7];
					$9 = inlets[8];

				  process(inputs, outputs)
				}
				`
			);

			this.processFunction = createProcessorFn(
				setPortCount,
				setAudioPortCount,
				setTitle,
				recv,
				send
			);
		} catch (error) {
			console.error('Failed to compile DSP code:', error);
			this.processFunction = null;
		}
	}

	private setInletValues(values: unknown[]): void {
		this.inletValues = values;
	}

	private handleMessageInlet(message: unknown, meta: RecvMeta): void {
		if (!this.recvCallback) return;

		try {
			this.recvCallback(message, meta);
		} catch (error) {
			console.error('Error in DSP recv callback:', error);
		}
	}

	process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
		// Stop processing if destroy was called
		if (this.shouldStop) {
			return false;
		}

		const output = outputs[0] || [];

		// Keep the DSP node alive even without process function
		if (!this.processFunction) {
			// Pass through silence if no process function
			for (let channel = 0; channel < output.length; channel++) {
				if (output[channel]) {
					output[channel].fill(0);
				}
			}

			return true;
		}

		try {
			this.counter++;
			this.processFunction(inputs, outputs, this.inletValues, this.counter);
		} catch (error) {
			console.error('DSP processing error:', error);

			// Fill with silence on error
			for (let channel = 0; channel < output.length; channel++) {
				if (output[channel]) {
					output[channel].fill(0);
				}
			}
		}

		return true;
	}
}

registerProcessor('dsp-processor', DSPProcessor);
