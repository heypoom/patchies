import {
  type CompiledExpression,
  type ByteBeatContext,
  type ByteBeatExtra,
  ByteBeatCompiler
} from './bytebeat-compiler';
import { ByteBeatProcessor } from './bytebeat-processor';
import { WrappingStack } from './wrapping-stack';

class BeatWorkletProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'sampleRate', defaultValue: 8000 }];
  }

  private byteBeat = new ByteBeatProcessor();
  private expressions: string[] = [];
  private functions: CompiledExpression[] = [];
  private nextObjId = 1;
  private idToObj = new Map<number, WrappingStack | ByteBeatContext>();

  constructor() {
    super();

    this.port.onmessage = (event) => {
      const { cmd, data } = event.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fn = (this as any)[cmd];
      if (fn) {
        fn.call(this, data);
      } else {
        throw new Error(`BeatProcessor unknown command: '${cmd}'`);
      }
    };
  }

  private registerObj(obj: WrappingStack | ByteBeatContext): number {
    const id = this.nextObjId++;
    this.idToObj.set(id, obj);
    return id;
  }

  private deregisterObj(id: number): void {
    this.idToObj.delete(id);
  }

  setExtra(data: Partial<ByteBeatExtra>): void {
    this.byteBeat.setExtra(data);
  }

  callFunc({ fn, args }: { fn: string; args: unknown[] }): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.byteBeat as any)[fn].call(this.byteBeat, ...args);
  }

  callAsync({ fn, msgId, args }: { fn: string; msgId: number; args: unknown[] }): void {
    let result: unknown;
    let error: unknown;
    const transferables: Transferable[] = [];

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result = (this as any)[fn].call(this, ...args);
      if (result && Array.isArray(result)) {
        for (let i = 0; i < result.length; ++i) {
          const o = result[i];
          if (o instanceof Float32Array) {
            transferables.push(o.buffer);
          }
        }
      }
    } catch (e) {
      error = e;
    }

    this.port.postMessage(
      {
        cmd: 'asyncResult',
        data: { msgId, error, result }
      },
      transferables
    );
  }

  setExpressions(
    expressions: string[],
    resetToZero?: boolean
  ): { numChannels: number; expressions: string[] } | Record<string, never> {
    const compileExpressions = (
      expressions: string[],
      expressionType: number,
      extra: ByteBeatExtra
    ): CompiledExpression[] => {
      const funcs: CompiledExpression[] = [];

      try {
        for (let i = 0; i < expressions.length; ++i) {
          const exp = expressions[i];
          if (exp !== this.expressions[i]) {
            funcs.push(ByteBeatCompiler.compileExpression(exp, expressionType, extra));
          } else {
            if (this.functions[i]) {
              funcs.push(this.functions[i]);
            }
          }
        }
      } catch (e) {
        if (e instanceof Error && e.stack) {
          const m = /<anonymous>:1:(\d+)/.exec(e.stack);
          if (m) {
            const charNdx = parseInt(m[1]);
            console.error(e.stack);
            console.error(
              expressions.join('\n').substring(0, charNdx),
              '-----VVVVV-----\n',
              expressions.join('\n').substring(charNdx)
            );
          }
        } else {
          console.error(e);
        }
        throw e;
      }

      return funcs;
    };

    const funcs = compileExpressions(
      expressions,
      this.byteBeat.getExpressionType(),
      this.byteBeat.getExtra()
    );
    if (!funcs) {
      return {};
    }

    this.expressions = expressions.slice();
    this.functions = funcs;
    const exp = funcs.map(({ expression }) => expression);

    if (resetToZero) {
      this.setExpressionsAndResetToZero(exp);
    } else {
      this.setExpressionsForReal(exp);
    }

    return {
      numChannels: this.byteBeat.getNumChannels(),
      expressions: exp
    };
  }

  setExpressionsForReal(data: string[]): void {
    this.byteBeat.setExpressions(data);
  }

  setExpressionsAndResetToZero(data: string[]): void {
    this.byteBeat.reset();
    this.byteBeat.setExpressions(data);
    this.byteBeat.reset();
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    this.byteBeat.process(outputs[0][0].length, outputs[0][0], outputs[0][1]);
    return true;
  }

  createStack(): number {
    return this.registerObj(new WrappingStack());
  }

  createContext(): number {
    return this.registerObj(ByteBeatCompiler.makeContext());
  }

  destroyStack(id: number): void {
    this.deregisterObj(id);
  }

  destroyContext(id: number): void {
    this.deregisterObj(id);
  }

  getSamplesForTimeRange(
    start: number,
    end: number,
    numSamples: number,
    contextId: number,
    stackId: number,
    channel = 0
  ): Float32Array {
    const context = this.idToObj.get(contextId) as ByteBeatContext;
    const stack = this.idToObj.get(stackId) as WrappingStack;
    const data = new Float32Array(numSamples);
    const duration = end - start;

    for (let i = 0; i < numSamples; ++i) {
      const time = (start + (duration * i) / numSamples) | 0;
      data[i] = this.byteBeat.getSampleForTime(time, context, stack, channel);
    }

    return data;
  }
}

registerProcessor('bytebeat-processor', BeatWorkletProcessor);
