import { Parser } from 'expr-eval';
import { transformFExprExpression } from './fexpr-transform';

interface ExpressionMessage {
  type: 'set-expression';
  expression: string;
}

interface MultiExpressionMessage {
  type: 'set-expressions';
  assignments: string[];
  outletExpressions: string[];
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

  // y1-y9 accessor functions (output history per outlet, -1 = previous output, etc.)
  y1: (offset: number) => number,
  y2: (offset: number) => number,
  y3: (offset: number) => number,
  y4: (offset: number) => number,
  y5: (offset: number) => number,
  y6: (offset: number) => number,
  y7: (offset: number) => number,
  y8: (offset: number) => number,
  y9: (offset: number) => number,

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
  private evaluators: FExprDspFn[] = [];
  private inletValues: number[] = new Array(10).fill(0);

  // History buffers for input samples (one per inlet)
  // Circular buffer: historyIndex points to current sample position
  private inputHistory: Float32Array[] = [];

  // Per-outlet output history buffers
  private outputHistories: Float32Array[] = [new Float32Array(HISTORY_SIZE)];

  // Pre-allocated accessor functions to avoid allocation in hot path
  private inputAccessors: Array<(offset?: number) => number> = [];

  // Per-outlet output accessors: y1, y2, etc.
  private outputAccessors: Array<(offset: number) => number> = [];

  // Pre-extracted inlet values array
  private inletArgs: [number, number, number, number, number, number, number, number, number] = [
    0, 0, 0, 0, 0, 0, 0, 0, 0
  ];

  private historyIndex = 0;

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

    // Initialize with 1 output accessor
    this.rebuildOutputAccessors(1);

    this.port.onmessage = (
      event: MessageEvent<ExpressionMessage | MultiExpressionMessage | InletValuesMessage>
    ) => {
      if (event.data.type === 'set-expression') {
        this.setExpression(event.data.expression);
      } else if (event.data.type === 'set-expressions') {
        this.setExpressions(event.data.assignments, event.data.outletExpressions);
      } else if (event.data.type === 'set-inlet-values') {
        this.setInletValues(event.data.values);
      }
    };
  }

  /**
   * Rebuild output history buffers and accessor functions for a given outlet count.
   */
  private rebuildOutputAccessors(outletCount: number): void {
    this.outputHistories = [];
    this.outputAccessors = [];

    for (let i = 0; i < outletCount; i++) {
      const history = new Float32Array(HISTORY_SIZE);

      this.outputHistories.push(history);

      this.outputAccessors.push((offset: number) => {
        if (offset >= 0) return 0;

        return this.getHistorySample(history, offset);
      });
    }
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

  private createParser(): Parser {
    return new Parser({
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
  }

  // Parameter names matching FExprDspFn signature
  private static parameterNames = [
    // Input accessors x1-x9
    ...Array.from({ length: 9 }, (_, i) => `x${i + 1}`),

    // Aliases s1-s9
    ...Array.from({ length: 9 }, (_, i) => `s${i + 1}`),

    // Output accessors y1-y9
    ...Array.from({ length: 9 }, (_, i) => `y${i + 1}`),

    // Other params
    'i',
    't',

    // Control values c1-c9
    ...Array.from({ length: 9 }, (_, i) => `c${i + 1}`)
  ];

  // Uses the shared pure function below
  private static transformExpression = transformFExprExpression;

  private compileExpression(expressionString: string): FExprDspFn | null {
    try {
      const transformed = FExprProcessor.transformExpression(expressionString);
      const parser = this.createParser();
      const expr = parser.parse(transformed);

      return expr.toJSFunction(FExprProcessor.parameterNames.join(',')) as FExprDspFn;
    } catch (error) {
      console.error('Failed to compile fexpr~ expression:', error);
      return null;
    }
  }

  private resetHistory(outletCount: number): void {
    for (const history of this.inputHistory) {
      history.fill(0);
    }

    this.historyIndex = 0;
    this.rebuildOutputAccessors(outletCount);
  }

  /**
   * Set a single expression (backwards compat, single outlet).
   */
  private setExpression(expressionString: string): void {
    if (!expressionString || expressionString.trim() === '') {
      this.evaluators = [];
      return;
    }

    this.resetHistory(1);

    const fn = this.compileExpression(expressionString);

    this.evaluators = fn ? [fn] : [];
  }

  /**
   * Set multiple outlet expressions with shared assignments.
   */
  private setExpressions(assignments: string[], outletExpressions: string[]): void {
    const outletCount = Math.max(1, outletExpressions.length);
    this.resetHistory(outletCount);

    const prefix = assignments.length > 0 ? assignments.join(';') + ';' : '';
    const fns: FExprDspFn[] = [];

    for (const outletExpr of outletExpressions) {
      const fn = this.compileExpression(prefix + outletExpr);

      if (fn) {
        fns.push(fn);
      } else {
        this.evaluators = [];
        return;
      }
    }

    this.evaluators = fns;
  }

  private setInletValues(values: number[]): void {
    for (let i = 0; i < Math.min(values.length, 10); i++) {
      this.inletValues[i] = values[i];
    }
  }

  // Dummy accessor that always returns 0 (for unused y slots)
  private static zeroAccessor = () => 0;

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    // Keep alive even without evaluators
    if (this.evaluators.length === 0) {
      for (const output of outputs) {
        if (output[0]) output[0].fill(0);
      }

      return true;
    }

    try {
      const bufferSize = outputs[0]?.[0]?.length ?? 128;

      // Snapshot control values once per block
      const args = this.inletArgs;

      for (let k = 0; k < 9; k++) {
        args[k] = this.inletValues[k];
      }

      // Build y accessor array: real accessors for existing outlets, zero for the rest
      const ya = this.outputAccessors;
      const y1 = ya[0] ?? FExprProcessor.zeroAccessor;
      const y2 = ya[1] ?? FExprProcessor.zeroAccessor;
      const y3 = ya[2] ?? FExprProcessor.zeroAccessor;
      const y4 = ya[3] ?? FExprProcessor.zeroAccessor;
      const y5 = ya[4] ?? FExprProcessor.zeroAccessor;
      const y6 = ya[5] ?? FExprProcessor.zeroAccessor;
      const y7 = ya[6] ?? FExprProcessor.zeroAccessor;
      const y8 = ya[7] ?? FExprProcessor.zeroAccessor;
      const y9 = ya[8] ?? FExprProcessor.zeroAccessor;

      // Process sample by sample (required for feedback to work correctly)
      for (let i = 0; i < bufferSize; i++) {
        const t = (currentFrame + i) / sampleRate;

        // Store current input samples in history
        for (let inlet = 0; inlet < MAX_SIGNAL_INLETS; inlet++) {
          const sample = inputs[inlet]?.[0]?.[i] ?? 0;

          this.inputHistory[inlet][this.historyIndex] = sample;
        }

        // Evaluate each outlet expression
        for (let outIdx = 0; outIdx < this.evaluators.length; outIdx++) {
          const outBuf = outputs[outIdx]?.[0];
          if (!outBuf) continue;

          try {
            const result = this.evaluators[outIdx](
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

              // y1-y9 output history accessors
              y1,
              y2,
              y3,
              y4,
              y5,
              y6,
              y7,
              y8,
              y9,

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

            const value = typeof result === 'number' && !isNaN(result) ? result : 0;
            outBuf[i] = value;

            // Store in this outlet's history (for y access in next sample)
            this.outputHistories[outIdx][this.historyIndex] = value;
          } catch {
            outBuf[i] = 0;
            this.outputHistories[outIdx][this.historyIndex] = 0;
          }
        }

        // Advance history index after all outlets are evaluated
        this.historyIndex = (this.historyIndex + 1) % HISTORY_SIZE;
      }
    } catch (error) {
      console.error('fexpr~ processing error:', error);
    }

    return true;
  }
}

registerProcessor('fexpr-processor', FExprProcessor);
