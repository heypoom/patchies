import { Parser } from 'expr-eval';

interface ExpressionMessage {
  type: 'set-expression';
  expression: string;
}

interface InletValuesMessage {
  type: 'set-inlet-values';
  values: number[];
}

type ExprDspFn = (
  s: number,
  i: number,
  t: number,
  channel: number,
  bufferSize: number,
  samples: Float32Array,
  input: Float32Array[],
  inputs: Float32Array[][],
  ...inletValues: number[]
) => number;

class ExpressionProcessor extends AudioWorkletProcessor {
  private evaluator: ExprDspFn | null = null;
  private inletValues: number[] = new Array(10).fill(0);

  // Phasor state: up to 10 independent phasors per expression
  private phasorPhases: number[] = new Array(10).fill(0);
  private phasorIndex = 0;

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

  /**
   * Phasor function: returns a 0-1 ramp at the given frequency.
   * Each call within an expression uses a separate phase accumulator.
   * Usage: sin(phasor(440) * 2 * PI) for a 440Hz sine wave
   */
  private phasor = (freq: number): number => {
    const idx = this.phasorIndex++;
    if (idx >= this.phasorPhases.length) return 0;

    // Accumulate phase
    this.phasorPhases[idx] += freq / sampleRate;

    // Wrap to 0-1 range
    this.phasorPhases[idx] %= 1;

    if (this.phasorPhases[idx] < 0) {
      this.phasorPhases[idx] += 1;
    }

    return this.phasorPhases[idx];
  };

  private setExpression(expressionString: string): void {
    if (!expressionString || expressionString.trim() === '') {
      this.evaluator = null;
      return;
    }

    // Reset phasor state when expression changes
    this.phasorPhases.fill(0);
    this.phasorIndex = 0;

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

    // Add phasor as a custom function
    parser.functions.phasor = this.phasor;

    try {
      // Replace $1, $2, etc. with x1, x2, etc. for expr-eval compatibility
      const renamedExpression = expressionString.replace(/\$(\d+)/g, 'x$1');

      const expr = parser.parse(renamedExpression);

      // Create parameter names: s (sample), i (sample index), t (time in seconds), channel, bufferSize,
      // samples (current channel samples), input (first input), inputs (all inputs), x1-x9 (inlet values)
      const parameterNames = [
        's',
        'i',
        't',
        'channel',
        'bufferSize',
        'samples',
        'input',
        'inputs',
        ...Array.from({ length: 9 }, (_, i) => `x${i + 1}`)
      ];

      this.evaluator = expr.toJSFunction(parameterNames.join(',')) as ExprDspFn;
    } catch (error) {
      console.error('Failed to compile expression:', error);
    }
  }

  private setInletValues(values: number[]): void {
    // Update inlet values, filling up to 10 slots
    for (let i = 0; i < Math.min(values.length, 10); i++) {
      this.inletValues[i] = values[i];
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
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
      const bufferSize = input[0] ? input[0].length : 128;

      // Always process at least one channel, even without input
      const channelCount = Math.max(output.length, 1);

      // Sample-first loop so phasor state is consistent across channels
      for (let i = 0; i < bufferSize; i++) {
        // Reset phasor index at start of each sample
        this.phasorIndex = 0;

        const t = (currentFrame + i) / sampleRate;

        for (let channel = 0; channel < channelCount; channel++) {
          const samples = input[channel] || new Float32Array(bufferSize);
          const outs = output[channel] || new Float32Array(bufferSize);

          const s = samples[i] || 0;

          try {
            // Call evaluator with: s, i, t, channel, bufferSize, samples, input, inputs, x1-x9
            const result = this.evaluator(
              s, // current sample value
              i, // sample index in buffer
              t, // current time in seconds
              channel, // current channel number
              bufferSize, // buffer size
              samples, // current channel samples array
              input, // first input (all channels)
              inputs, // all inputs
              ...this.inletValues.slice(0, 9) // inlet values x1-x9
            );

            if (typeof result !== 'number' || isNaN(result)) {
              outs[i] = 0;
              continue;
            }

            outs[i] = result;
          } catch {
            outs[i] = 0;
          }
        }
      }
    } catch (error) {
      console.error('Expression processing error:', error);
    }

    return true;
  }
}

registerProcessor('expression-processor', ExpressionProcessor);
