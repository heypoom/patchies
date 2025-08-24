interface ExpressionMessage {
	type: 'set-expression';
	expression: string;
}

class ExpressionProcessor extends AudioWorkletProcessor {
	private processor: Function | null = null;

	constructor() {
		super();
		this.port.onmessage = (event: MessageEvent<ExpressionMessage>) => {
			if (event.data.type === 'set-expression') {
				this.setExpression(event.data.expression);
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
			this.processor = new Function('input', 'output', 'parameters', userCode);
		} catch (error) {
			this.processor = null;
			console.error('Failed to compile expression:', error);
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
			this.processor(input, output, parameters);
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
