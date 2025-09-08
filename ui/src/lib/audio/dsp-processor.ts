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
	meta: {
		source: string;
		outlet?: number;
		inlet?: number;
		inletKey?: string;
		outletKey?: string;
	};
}

type ProcessFunction = (
	inputs: Float32Array[][],
	outputs: Float32Array[][],
	$1: unknown,
	$2: unknown,
	$3: unknown,
	$4: unknown,
	$5: unknown,
	$6: unknown,
	$7: unknown,
	$8: unknown,
	$9: unknown,
	counter: number
) => void;

class DSPProcessor extends AudioWorkletProcessor {
	private processFunction: ProcessFunction | null = null;
	private inletValues: unknown[] = new Array(10).fill(0);
	private counter = 0;
	private messageInletCount = 0;
	private recvCallback: ((message: unknown, meta: any) => void) | null = null;

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

			// Create recv function that will be available in user code
			const recv = (callback: (message: unknown, meta: any) => void) => {
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
					x1,
					x2,
					x3,
					x4,
					x5,
					x6,
					x7,
					x8,
					x9,
					counter
				) => {
					$1 = x1; $2 = x2; $3 = x3; $4 = x4; $5 = x5; $6 = x6; $7 = x7; $8 = x8; $9 = x9;

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

	private handleMessageInlet(inletIndex: number, message: unknown, meta: any): void {
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
			// Increment counter each time process is called
			this.counter++;

			// Call user's process function
			this.processFunction(
				inputs,
				outputs,
				this.inletValues[0],
				this.inletValues[1],
				this.inletValues[2],
				this.inletValues[3],
				this.inletValues[4],
				this.inletValues[5],
				this.inletValues[6],
				this.inletValues[7],
				this.inletValues[8],
				this.counter
			);
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
