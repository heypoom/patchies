interface ExpressionMessage {
	type: 'set-expression';
	expression: string;
}

interface InletValuesMessage {
	type: 'set-inlet-values';
	values: number[];
}

class ExpressionProcessor extends AudioWorkletProcessor {
	private processor: Function | null = null;
	private inletValues: number[] = new Array(10).fill(0);

	constructor() {
		super();
		this.port.onmessage = (event: MessageEvent<ExpressionMessage | InletValuesMessage>) => {
			if (event.data.type === 'set-expression') {
				this.setExpression(event.data.expression);
			} else if (event.data.type === 'set-inlet-values') {
				this.setInletValues(event.data.values);
			}
		};
	}

	private setExpression(expressionString: string): void {
		if (!expressionString || expressionString.trim() === '') {
			this.processor = null;
			return;
		}

		const userCode = `
			const numChannels = input.length;
			const numSamples = input[0] ? input[0].length : 128;
			const [$1=0, $2=0, $3=0, $4=0, $5=0, $6=0, $7=0, $8=0, $9=0] = inletValues;

			for (let channel = 0; channel < numChannels; channel++) {
				const inChannel = input[channel] || new Float32Array(numSamples);
				const outChannel = output[channel] || new Float32Array(numSamples);

				for (let i = 0; i < numSamples; i++) {
					const sample = inChannel[i] || 0;
					try {
						outChannel[i] = ${expressionString};
					} catch (e) {
						outChannel[i] = 0;
					}
				}
			}
		`;

		try {
			this.processor = new Function('input', 'output', 'parameters', 'inletValues', userCode);
		} catch (error) {
			this.processor = null;
			console.error('Failed to compile expression:', error);
		}
	}

	private setInletValues(values: number[]): void {
		// Update inlet values, filling up to 10 slots
		for (let i = 0; i < Math.min(values.length, 10); i++) {
			this.inletValues[i] = values[i];
		}
	}

	process(
		inputs: Float32Array[][],
		outputs: Float32Array[][],
		parameters: Record<string, Float32Array>
	): boolean {
		const input = inputs[0] || [];
		const output = outputs[0] || [];

		// Keep the expression node alive even without processor
		if (!this.processor) {
			// Pass through silence if no processor
			for (let channel = 0; channel < output.length; channel++) {
				if (output[channel]) {
					output[channel].fill(0);
				}
			}
			return true;
		}

		try {
			this.processor(input, output, parameters, this.inletValues);
		} catch (error) {
			console.error('Expression processing error:', error);
			this.processor = null;
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

registerProcessor('expression-processor', ExpressionProcessor);
