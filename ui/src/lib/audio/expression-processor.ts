import { Parser } from 'expr-eval';

interface ExpressionMessage {
	type: 'set-expression';
	expression: string;
}

interface InletValuesMessage {
	type: 'set-inlet-values';
	values: number[];
}

const parser = new Parser({
	operators: {
		add: true,
		concatenate: true,
		conditional: true,
		divide: true,
		factorial: true,
		multiply: true,
		power: true,
		remainder: true,
		subtract: true,
		logical: true,
		comparison: true,
		in: true,
		assignment: true
	}
});

class ExpressionProcessor extends AudioWorkletProcessor {
	private evaluator: ((...args: number[]) => number) | null = null;
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
			this.evaluator = null;
			return;
		}

		try {
			// Replace $1, $2, etc. with x1, x2, etc. for expr-eval compatibility
			const renamedExpression = expressionString.replace(/\$(\d+)/g, 'x$1');
			
			// Add support for 's' variable for current sample
			const finalExpression = renamedExpression.replace(/\bs\b/g, 's');
			
			const expr = parser.parse(finalExpression);
			
			// Create parameter names: s, x1, x2, ..., x9 for sample and inlet values
			const parameterNames = ['s', ...Array.from({length: 9}, (_, i) => `x${i + 1}`)];
			
			this.evaluator = expr.toJSFunction(parameterNames.join(',')) as (...args: number[]) => number;
		} catch (error) {
			this.evaluator = null;
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

		// Keep the expression node alive even without evaluator
		if (!this.evaluator) {
			// Pass through silence if no evaluator
			for (let channel = 0; channel < output.length; channel++) {
				if (output[channel]) {
					output[channel].fill(0);
				}
			}
			return true;
		}

		try {
			const ns = input[0] ? input[0].length : 128;
			
			for (let chan = 0; chan < input.length; chan++) {
				const samples = input[chan] || new Float32Array(ns);
				const outs = output[chan] || new Float32Array(ns);

				for (let i = 0; i < ns; i++) {
					const s = samples[i] || 0;
					
					try {
						// Call evaluator with current sample + inlet values
						const result = this.evaluator(s, ...this.inletValues.slice(0, 9));
						outs[i] = typeof result === 'number' ? result : 0;
					} catch (e) {
						outs[i] = 0;
					}
				}
			}
		} catch (error) {
			console.error('Expression processing error:', error);
			this.evaluator = null;
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
