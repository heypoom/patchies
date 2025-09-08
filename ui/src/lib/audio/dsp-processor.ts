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
	private inletValues: number[] = new Array(10).fill(0);
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

	private setCode(codeString: string): void {
		if (!codeString || codeString.trim() === '') {
			this.processFunction = null;
			return;
		}

		try {
			// Replace $1, $2, etc. with actual inlet values in the code
			const processedCode = codeString.replace(/\$(\d+)/g, (_, num) => {
				const index = parseInt(num, 10) - 1;
				return `this.inletValues[${index}] || 0`;
			});

			// Create function that has access to inlet values and counter
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
				const process = ${processedCode.includes('function') || processedCode.includes('=>') ? processedCode : `(inputs, outputs) => {\n${processedCode}\n}`};
				
				if (typeof process === 'function') {
					process(inputs, outputs);
				}
				`
			);

			this.processFunction = (inputs: Float32Array[][], outputs: Float32Array[][]) => {
				userFunction.call(
					this,
					inputs,
					outputs,
					this.inletValues[0] || 0,
					this.inletValues[1] || 0,
					this.inletValues[2] || 0,
					this.inletValues[3] || 0,
					this.inletValues[4] || 0,
					this.inletValues[5] || 0,
					this.inletValues[6] || 0,
					this.inletValues[7] || 0,
					this.inletValues[8] || 0,
					this.counter
				);
			};
		} catch (error) {
			console.error('Failed to compile DSP code:', error);
			this.processFunction = null;
		}
	}

	private setInletValues(values: number[]): void {
		// Update inlet values, filling up to 10 slots
		for (let i = 0; i < Math.min(values.length, 10); i++) {
			this.inletValues[i] = values[i];
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
