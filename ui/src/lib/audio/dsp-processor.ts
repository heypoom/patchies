interface DSPMessage {
	type: 'set-code';
	code: string;
}

interface InletValuesMessage {
	type: 'set-inlet-values';
	values: number[];
}

type ProcessFunction = (inputs: Float32Array[][], outputs: Float32Array[][]) => void;

class DSPProcessor extends AudioWorkletProcessor {
	private processFunction: ProcessFunction | null = null;
	private inletValues: unknown[] = new Array(10).fill(0);
	private counter = 0;

	constructor() {
		super();
		this.port.onmessage = (event: MessageEvent<DSPMessage | InletValuesMessage>) => {
			if (event.data.type === 'set-code') {
				this.setCode(event.data.code);
			} else if (event.data.type === 'set-inlet-values') {
				this.setInletValues(event.data.values);
			}
		};
	}

	private setCode(code: string): void {
		if (!code || code.trim() === '') {
			this.processFunction = null;
			return;
		}

		try {
			const isFunction = code.includes('function') || code.includes('=>');

			const userFunction = new Function(
				'inputs',
				'outputs',
				'$1',
				'$2',
				'$3',
				'$4',
				'$5',
				'$6',
				'$7',
				'$8',
				'$9',
				'counter',
				`
				const process = ${isFunction ? code : `(inputs, outputs) => {\n${code}\n}`};
				
				if (typeof process === 'function') {
					process(inputs, outputs);
				}
				`
			);

			this.processFunction = (inputs: Float32Array[][], outputs: Float32Array[][]) => {
				userFunction(
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
			};
		} catch (error) {
			console.error('Failed to compile DSP code:', error);
			this.processFunction = null;
		}
	}

	private setInletValues(values: unknown[]): void {
		this.inletValues = values;
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
			this.processFunction(inputs, outputs);
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
