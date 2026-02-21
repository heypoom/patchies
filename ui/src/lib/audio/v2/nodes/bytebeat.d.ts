declare module 'bytebeat.js' {
  export default class ByteBeatNode extends AudioWorkletNode {
    static setup(context: AudioContext): Promise<void>;

    static Type: {
      byteBeat: number;
      floatBeat: number;
      signedByteBeat: number;
    };

    static ExpressionType: {
      infix: number;
      postfix: number;
      glitch: number;
      function: number;
    };

    constructor(context: AudioContext);

    setType(type: number): void;
    getType(): number;
    setExpressionType(expressionType: number): void;
    getExpressionType(): number;
    setDesiredSampleRate(rate: number): void;
    getDesiredSampleRate(): number;
    setExpressions(expressions: string[], resetToZero?: boolean): Promise<void>;
    reset(): void;
    isRunning(): boolean;
    getNumChannels(): number;
  }
}
