import { Parser } from 'expr-eval';

interface ExpressionMessage {
  type: 'set-expression';
  expression: string;
}

interface InletValuesMessage {
  type: 'set-inlet-values';
  values: number[];
}

// Function signature for the compiled expression
// Parameters are passed positionally to avoid object allocation in the hot path
type FExprDspFn = (
  // x1-x9 accessor functions (return sample at offset, 0 = current, -1 = previous, etc.)
  x1: (offset?: number) => number,
  x2: (offset?: number) => number,
  x3: (offset?: number) => number,
  x4: (offset?: number) => number,
  x5: (offset?: number) => number,
  x6: (offset?: number) => number,
  x7: (offset?: number) => number,
  x8: (offset?: number) => number,
  x9: (offset?: number) => number,

  // Aliases: s1-s9 = x1-x9
  s1: (offset?: number) => number,
  s2: (offset?: number) => number,
  s3: (offset?: number) => number,
  s4: (offset?: number) => number,
  s5: (offset?: number) => number,
  s6: (offset?: number) => number,
  s7: (offset?: number) => number,
  s8: (offset?: number) => number,
  s9: (offset?: number) => number,

  // y1 accessor function (output history, -1 = previous output, etc.)
  y1: (offset: number) => number,

  // Other parameters
  i: number,
  t: number,

  // Control inlet values c1-c9 (from $1-$9)
  c1: number,
  c2: number,
  c3: number,
  c4: number,
  c5: number,
  c6: number,
  c7: number,
  c8: number,
  c9: number
) => number;

const HISTORY_SIZE = 128; // Web Audio block size
const MAX_SIGNAL_INLETS = 9;

class FExprProcessor extends AudioWorkletProcessor {
  private evaluator: FExprDspFn | null = null;
  private inletValues: number[] = new Array(10).fill(0);

  // History buffers for input samples (one per inlet)
  // Circular buffer: historyIndex points to current sample position
  private inputHistory: Float32Array[] = [];
  private outputHistory: Float32Array = new Float32Array(HISTORY_SIZE);
  private historyIndex = 0;

  // Pre-allocated accessor functions to avoid allocation in hot path
  private inputAccessors: Array<(offset?: number) => number> = [];
  private outputAccessor: (offset: number) => number;

  // Pre-extracted inlet values array
  private inletArgs: [number, number, number, number, number, number, number, number, number] = [
    0, 0, 0, 0, 0, 0, 0, 0, 0
  ];

  constructor() {
    super();

    // Initialize input history buffers
    for (let i = 0; i < MAX_SIGNAL_INLETS; i++) {
      this.inputHistory.push(new Float32Array(HISTORY_SIZE));
    }

    // Create accessor functions for each input
    for (let i = 0; i < MAX_SIGNAL_INLETS; i++) {
      const history = this.inputHistory[i];
      this.inputAccessors.push((offset: number = 0) => {
        return this.getHistorySample(history, offset);
      });
    }

    // Create output accessor
    this.outputAccessor = (offset: number) => {
      // Output history only allows negative offsets (previous samples)
      if (offset >= 0) return 0;
      return this.getHistorySample(this.outputHistory, offset);
    };

    this.port.onmessage = (event: MessageEvent<ExpressionMessage | InletValuesMessage>) => {
      if (event.data.type === 'set-expression') {
        this.setExpression(event.data.expression);
      } else if (event.data.type === 'set-inlet-values') {
        this.setInletValues(event.data.values);
      }
    };
  }

  /**
   * Get a sample from a history buffer at the given offset.
   * Offset 0 = current sample, -1 = previous sample, etc.
   * Supports linear interpolation for fractional offsets.
   */
  private getHistorySample(history: Float32Array, offset: number): number {
    if (offset > 0) return 0; // Can't look into the future

    // Handle fractional offsets with linear interpolation
    const offsetInt = Math.ceil(offset); // e.g., -1.5 -> -1
    const frac = offset - offsetInt; // e.g., -1.5 - (-1) = -0.5

    const idx1 = (this.historyIndex + offsetInt + HISTORY_SIZE) % HISTORY_SIZE;

    if (frac === 0) {
      return history[idx1];
    }

    // Linear interpolation between two samples
    const idx2 = (this.historyIndex + offsetInt - 1 + HISTORY_SIZE) % HISTORY_SIZE;
    const s1 = history[idx1];
    const s2 = history[idx2];

    // frac is negative, so we interpolate towards s2
    return s1 + (s2 - s1) * -frac;
  }

  private setExpression(expressionString: string): void {
    if (!expressionString || expressionString.trim() === '') {
      this.evaluator = null;
      return;
    }

    // Reset history when expression changes
    for (const history of this.inputHistory) {
      history.fill(0);
    }
    this.outputHistory.fill(0);
    this.historyIndex = 0;

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

    try {
      // Transform expression:
      // 1. $1, $2, etc. -> c1, c2, etc. (control values)
      // 2. x1[-1], s1[-2], etc. -> x1(-1), s1(-2) (function call syntax for history)
      // 3. y1[-1] -> y1(-1)
      // 4. bare x1, s1 (no brackets) -> x1(0), s1(0)
      const transformed = expressionString
        // Control values: $1 -> c1
        .replace(/\$(\d+)/g, 'c$1')
        // Input history access: x1[-1] or s1[-1] -> x1(-1) or s1(-1)
        .replace(/([xs])(\d+)\[(-?\d+(?:\.\d+)?)\]/g, '$1$2($3)')
        // Output history access: y1[-1] -> y1(-1)
        .replace(/y(\d+)\[(-?\d+(?:\.\d+)?)\]/g, 'y$1($2)')
        // Bare x1, s1 without brackets -> x1(0), s1(0) (current sample)
        // Use negative lookahead to avoid transforming already-converted x1(
        .replace(/\b([xs])(\d+)\b(?!\s*\()/g, '$1$2(0)');

      const expr = parser.parse(transformed);

      // Parameter names matching FExprDspFn signature
      const parameterNames = [
        // Input accessors x1-x9
        ...Array.from({ length: 9 }, (_, i) => `x${i + 1}`),
        // Aliases s1-s9
        ...Array.from({ length: 9 }, (_, i) => `s${i + 1}`),
        // Output accessor y1
        'y1',
        // Other params
        'i',
        't',
        // Control values c1-c9
        ...Array.from({ length: 9 }, (_, i) => `c${i + 1}`)
      ];

      this.evaluator = expr.toJSFunction(parameterNames.join(',')) as FExprDspFn;
    } catch (error) {
      console.error('Failed to compile fexpr~ expression:', error);
      this.evaluator = null;
    }
  }

  private setInletValues(values: number[]): void {
    for (let i = 0; i < Math.min(values.length, 10); i++) {
      this.inletValues[i] = values[i];
    }
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0]?.[0];
    if (!output) return true;

    // Keep alive even without evaluator
    if (!this.evaluator) {
      output.fill(0);
      return true;
    }

    try {
      const bufferSize = output.length;

      // Snapshot control values once per block
      const args = this.inletArgs;
      for (let k = 0; k < 9; k++) {
        args[k] = this.inletValues[k];
      }

      // Process sample by sample (required for feedback to work correctly)
      for (let i = 0; i < bufferSize; i++) {
        const t = (currentFrame + i) / sampleRate;

        // Store current input samples in history
        for (let inlet = 0; inlet < MAX_SIGNAL_INLETS; inlet++) {
          const sample = inputs[inlet]?.[0]?.[i] ?? 0;
          this.inputHistory[inlet][this.historyIndex] = sample;
        }

        try {
          // Call evaluator with all accessors and values
          const result = this.evaluator(
            // x1-x9 accessors
            this.inputAccessors[0],
            this.inputAccessors[1],
            this.inputAccessors[2],
            this.inputAccessors[3],
            this.inputAccessors[4],
            this.inputAccessors[5],
            this.inputAccessors[6],
            this.inputAccessors[7],
            this.inputAccessors[8],
            // s1-s9 accessors (same as x1-x9)
            this.inputAccessors[0],
            this.inputAccessors[1],
            this.inputAccessors[2],
            this.inputAccessors[3],
            this.inputAccessors[4],
            this.inputAccessors[5],
            this.inputAccessors[6],
            this.inputAccessors[7],
            this.inputAccessors[8],
            // y1 accessor
            this.outputAccessor,
            // i, t
            i,
            t,
            // c1-c9 control values
            args[0],
            args[1],
            args[2],
            args[3],
            args[4],
            args[5],
            args[6],
            args[7],
            args[8]
          );

          if (typeof result !== 'number' || isNaN(result)) {
            output[i] = 0;
          } else {
            output[i] = result;
          }
        } catch {
          output[i] = 0;
        }

        // Store output in history (for y1[-1] access in next sample)
        this.outputHistory[this.historyIndex] = output[i];

        // Advance history index
        this.historyIndex = (this.historyIndex + 1) % HISTORY_SIZE;
      }
    } catch (error) {
      console.error('fexpr~ processing error:', error);
      output.fill(0);
    }

    return true;
  }
}

registerProcessor('fexpr-processor', FExprProcessor);
