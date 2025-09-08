interface DSPMessage {
	type: 'set-code';
	code: string;
}

interface InletValuesMessage {
	type: 'set-inlet-values';
	values: number[];
}

interface MessageInletMessage {
	type: 'message-inlet';
	inletIndex: number;
	message: unknown;
	meta: RecvMeta;
}

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
	private recvCallback: ((message: unknown, meta: RecvMeta) => void) | null = null;

	constructor() {
		super();
		this.port.onmessage = (
			event: MessageEvent<DSPMessage | InletValuesMessage | MessageInletMessage>
		) => {
			if (event.data.type === 'set-code') {
				this.setCode(event.data.code);
			} else if (event.data.type === 'set-inlet-values') {
				this.setInletValues(event.data.values);
			} else if (event.data.type === 'message-inlet') {
				this.handleMessageInlet(event.data.inletIndex, event.data.message, event.data.meta);
			}
		};
	}

	private setCode(code: string): void {
		if (!code || code.trim() === '') {
			this.processFunction = null;
			return;
		}

		try {
			// Reset message inlet count and recv callback for new code
			this.messageInletCount = 0;
			this.recvCallback = null;

			// Create setPortCount function that will be available in user code
			const setPortCount = (count: number) => {
				this.messageInletCount = Math.max(0, count);

				this.port.postMessage({
					type: 'port-count-changed',
					messageInletCount: this.messageInletCount
				});
			};

			const recv = (callback: (message: unknown, meta: RecvMeta) => void) => {
				this.recvCallback = callback;
			};

			const createProcessorFn = new Function(
				'setPortCount',
				'recv',
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

			this.processFunction = createProcessorFn(setPortCount, recv);
		} catch (error) {
			console.error('Failed to compile DSP code:', error);
			this.processFunction = null;
		}
	}

	private setInletValues(values: unknown[]): void {
		this.inletValues = values;
	}

	private handleMessageInlet(inletIndex: number, message: unknown, meta: RecvMeta): void {
		if (this.recvCallback) {
			try {
				this.recvCallback(message, meta);
			} catch (error) {
				console.error('Error in DSP recv callback:', error);
			}
		}
	}

	process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
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
