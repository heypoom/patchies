/**
 * Bytebeat AudioWorklet Processor
 *
 * Forked from bytebeat.js (https://github.com/nicholasbs/bytebeat.js)
 * MIT License - Copyright (c) 2023 Nicholas Scheurich
 *
 * This file contains all the bytebeat processing logic in a single file
 * to work properly with Vite's AudioWorklet bundling.
 */

import {
  ByteBeatCompiler,
  type ByteBeatContext,
  type ByteBeatExtra,
  type CompiledExpression
} from './bytebeat-compiler';
import { WrappingStack } from './wrapping-stack';

const int8 = new Int8Array(1);

// ============================================================================
// ByteBeatProcessor
// ============================================================================

type SamplerFn = (
  buffer0: Float32Array,
  buffer1: Float32Array,
  fn0: CompiledExpression['f'],
  fn1: CompiledExpression['f'] | undefined,
  time: number,
  divisor: number,
  stack0: WrappingStack,
  stack1: WrappingStack,
  ctx0: ByteBeatContext,
  ctx1: ByteBeatContext,
  extra: ByteBeatExtra,
  lastSample: number
) => void;

export class ByteBeatProcessor {
  static s_samplers: {
    array: SamplerFn[];
    twoChannels: SamplerFn[];
    oneChannel: SamplerFn[];
  } = {
    array: [
      // case 0: bytebeat
      function (
        buffer0,
        buffer1,
        fn0,
        _fn1,
        time,
        divisor,
        stack0,
        _stack1,
        ctx0,
        _ctx1,
        extra,
        lastSample
      ) {
        const sampleRate = extra?.sampleRate || 8000;
        for (let i = 0; i < lastSample; ++i) {
          const s = fn0.call(ctx0, time / divisor, sampleRate, stack0, ctx0, extra) as [
            number,
            number
          ];
          buffer0[time % buffer0.length] = (s[0] & 255) / 127 - 1;
          buffer1[time % buffer1.length] = (s[1] & 255) / 127 - 1;
          ++time;
        }
      },
      // case 1: floatbeat
      function (
        buffer0,
        buffer1,
        fn0,
        _fn1,
        time,
        divisor,
        stack0,
        _stack1,
        ctx0,
        _ctx1,
        extra,
        lastSample
      ) {
        const sampleRate = extra?.sampleRate || 8000;
        for (let i = 0; i < lastSample; ++i) {
          const s = fn0.call(ctx0, time / divisor, sampleRate, stack0, ctx0, extra) as [
            number,
            number
          ];
          buffer0[time % buffer0.length] = Number.isNaN(s[0]) ? 0 : s[0];
          buffer1[time % buffer1.length] = Number.isNaN(s[1]) ? 0 : s[1];
          ++time;
        }
      },
      // case 2: signed bytebeat
      function (
        buffer0,
        buffer1,
        fn0,
        _fn1,
        time,
        divisor,
        stack0,
        _stack1,
        ctx0,
        _ctx1,
        extra,
        lastSample
      ) {
        const sampleRate = extra?.sampleRate || 8000;
        for (let i = 0; i < lastSample; ++i) {
          const s = fn0.call(ctx0, time / divisor, sampleRate, stack0, ctx0, extra) as [
            number,
            number
          ];
          int8[0] = s[0];
          buffer0[time % buffer0.length] = int8[0] / 128;
          int8[0] = s[1];
          buffer1[time % buffer1.length] = int8[0] / 128;
          ++time;
        }
      }
    ],
    twoChannels: [
      // case 0: bytebeat
      function (
        buffer0,
        buffer1,
        fn0,
        fn1,
        time,
        divisor,
        stack0,
        stack1,
        ctx0,
        ctx1,
        extra,
        lastSample
      ) {
        const sampleRate = extra?.sampleRate || 8000;
        for (let i = 0; i < lastSample; ++i) {
          buffer0[time % buffer0.length] =
            ((fn0.call(ctx0, time / divisor, sampleRate, stack0, ctx0, extra) as number) & 255) /
              127 -
            1;
          buffer1[time % buffer1.length] =
            ((fn1!.call(ctx1, time / divisor, sampleRate, stack1, ctx1, extra) as number) & 255) /
              127 -
            1;
          ++time;
        }
      },
      // case 1: floatbeat
      function (
        buffer0,
        buffer1,
        fn0,
        fn1,
        time,
        divisor,
        stack0,
        stack1,
        ctx0,
        ctx1,
        extra,
        lastSample
      ) {
        const sampleRate = extra?.sampleRate || 8000;
        for (let i = 0; i < lastSample; ++i) {
          const s0 = fn0.call(ctx0, time / divisor, sampleRate, stack0, ctx0, extra) as number;
          buffer0[time % buffer0.length] = Number.isNaN(s0) ? 0 : s0;
          const s1 = fn1!.call(ctx1, time / divisor, sampleRate, stack1, ctx1, extra) as number;
          buffer1[time % buffer1.length] = Number.isNaN(s1) ? 0 : s1;
        }
      },
      // case 2: signed bytebeat
      function (
        buffer0,
        buffer1,
        fn0,
        fn1,
        time,
        divisor,
        stack0,
        stack1,
        ctx0,
        ctx1,
        extra,
        lastSample
      ) {
        const sampleRate = extra?.sampleRate || 8000;
        for (let i = 0; i < lastSample; ++i) {
          int8[0] = fn0.call(ctx0, time / divisor, sampleRate, stack0, ctx0, extra) as number;
          buffer0[time % buffer0.length] = int8[0] / 128;
          int8[0] = fn1!.call(ctx1, time / divisor, sampleRate, stack1, ctx1, extra) as number;
          buffer1[time % buffer1.length] = int8[0] / 128;
          ++time;
        }
      }
    ],
    oneChannel: [
      // case 0: bytebeat
      function (
        buffer0,
        _buffer1,
        fn0,
        _fn1,
        time,
        divisor,
        stack0,
        _stack1,
        ctx0,
        _ctx1,
        extra,
        lastSample
      ) {
        const sampleRate = extra?.sampleRate || 8000;
        for (let i = 0; i < lastSample; ++i) {
          buffer0[time % buffer0.length] =
            ((fn0.call(ctx0, time / divisor, sampleRate, stack0, ctx0, extra) as number) & 255) /
              127 -
            1;
          ++time;
        }
      },
      // case 1: floatbeat
      function (
        buffer0,
        _buffer1,
        fn0,
        _fn1,
        time,
        divisor,
        stack0,
        _stack1,
        ctx0,
        _ctx1,
        extra,
        lastSample
      ) {
        const sampleRate = extra?.sampleRate || 8000;
        for (let i = 0; i < lastSample; ++i) {
          const s = fn0.call(ctx0, time / divisor, sampleRate, stack0, ctx0, extra) as number;
          buffer0[time % buffer0.length] = Number.isNaN(s) ? 0 : s;
          ++time;
        }
      },
      // case 2: signed bytebeat
      function (
        buffer0,
        _buffer1,
        fn0,
        _fn1,
        time,
        divisor,
        stack0,
        _stack1,
        ctx0,
        _ctx1,
        extra,
        lastSample
      ) {
        const sampleRate = extra?.sampleRate || 8000;
        for (let i = 0; i < lastSample; ++i) {
          int8[0] = fn0.call(ctx0, time / divisor, sampleRate, stack0, ctx0, extra) as number;
          buffer0[time % buffer0.length] = int8[0] / 128;
          ++time;
        }
      }
    ]
  };

  static interpolate(buf: Float32Array, ndx: number): number {
    const n = ndx | 0;
    const f = ndx % 1;
    const v0 = buf[n % buf.length];
    const v1 = buf[(n + 1) % buf.length];
    return v0 + (v1 - v0) * f;
  }

  static trunc(buf: Float32Array, ndx: number): number {
    return buf[(ndx | 0) % buf.length];
  }

  buffer0 = new Float32Array(4096);
  buffer1 = new Float32Array(4096);
  desiredSampleRate = 8000;
  actualSampleRate = 44100;
  dstSampleCount = 0;
  srcSampleCount = 0;
  expandMode = 0;
  type = 0;
  expressionType = 0;
  functions: Array<{ f: CompiledExpression['f']; array: boolean }> = [
    {
      f: function () {
        return 0;
      },
      array: false
    }
  ];
  contexts = [ByteBeatCompiler.makeContext(), ByteBeatCompiler.makeContext()];
  expressions = ['Math.sin(t) * 0.1'];
  extra = ByteBeatCompiler.makeExtra();
  stacks = [new WrappingStack(), new WrappingStack()];

  reset(): void {
    this.dstSampleCount = 0;
    this.srcSampleCount = 0;
  }

  setExtra(props: Partial<ByteBeatExtra>): void {
    Object.assign(this.extra, props);
  }

  getExtra(): ByteBeatExtra {
    return { ...this.extra };
  }

  getTime(): number {
    return this.convertToDesiredSampleRate(this.dstSampleCount);
  }

  recompile(): void {
    this.setExpressions(this.getExpressions());
  }

  convertToDesiredSampleRate(rate: number): number {
    return Math.floor((rate * this.desiredSampleRate) / this.actualSampleRate);
  }

  setActualSampleRate(rate: number): void {
    this.actualSampleRate = rate;
  }

  setDesiredSampleRate(rate: number): void {
    this.desiredSampleRate = rate;
  }

  getDesiredSampleRate(): number {
    return this.desiredSampleRate;
  }

  setExpressionType(type: number): void {
    this.expressionType = type;
  }

  setExpressions(expressions: string[]): void {
    this.functions = expressions.map((expression) => {
      return ByteBeatCompiler.expressionStringToFn(expression, this.extra, false);
    });
  }

  getExpressions(): string[] {
    return this.expressions;
  }

  getExpressionType(): number {
    return this.expressionType;
  }

  setType(type: number): void {
    this.type = type;
  }

  getType(): number {
    return this.type;
  }

  getNumChannels(): number {
    const fn1 = this.functions[1]?.f;
    return this.functions[0].array || fn1 !== undefined ? 2 : 1;
  }

  process(dataLength: number, leftData: Float32Array, rightData?: Float32Array): void {
    const neededSrcStartSampleId = this.convertToDesiredSampleRate(this.dstSampleCount);
    const neededSrcEndSampleId =
      this.convertToDesiredSampleRate(this.dstSampleCount + dataLength) + 2;
    const numNeededSrcSamples = neededSrcEndSampleId - neededSrcStartSampleId;

    if (this.buffer0.length < numNeededSrcSamples) {
      this.buffer0 = new Float32Array(numNeededSrcSamples);
      this.buffer1 = new Float32Array(numNeededSrcSamples);
    }

    const fn0 = this.functions[0].f;
    const fn0Array = this.functions[0].array;
    const fn1 = this.functions[1]?.f;
    const hasFn1 = fn1 !== undefined;
    const stack0 = this.stacks[0];
    const stack1 = this.stacks[1];
    const ctx0 = this.contexts[0];
    const ctx1 = this.contexts[1];
    const buffer0 = this.buffer0;
    const buffer1 = fn0Array || hasFn1 ? this.buffer1 : buffer0;
    const extra = this.extra;
    const divisor = this.expressionType === 3 ? this.getDesiredSampleRate() : 1;

    const startSrcId = Math.max(this.srcSampleCount, neededSrcStartSampleId);
    const numSrcSampleToGenerate = neededSrcEndSampleId - startSrcId;

    const samplerGroup = fn0Array
      ? ByteBeatProcessor.s_samplers.array
      : hasFn1
        ? ByteBeatProcessor.s_samplers.twoChannels
        : ByteBeatProcessor.s_samplers.oneChannel;
    const sampler = samplerGroup[this.type];
    sampler(
      buffer0,
      buffer1,
      fn0,
      fn1,
      startSrcId,
      divisor,
      stack0,
      stack1,
      ctx0,
      ctx1,
      extra,
      numSrcSampleToGenerate
    );

    let ndx = (this.dstSampleCount * this.desiredSampleRate) / this.actualSampleRate;
    const step = this.desiredSampleRate / this.actualSampleRate;

    const expandFn = this.expandMode ? ByteBeatProcessor.interpolate : ByteBeatProcessor.trunc;

    if (rightData) {
      for (let i = 0; i < dataLength; ++i) {
        leftData[i] = expandFn(buffer0, ndx);
        rightData[i] = expandFn(buffer1, ndx);
        ndx += step;
      }
    } else {
      let localNdx = 0;
      for (let i = 0; i < dataLength; ++i) {
        leftData[i * 2] = expandFn(buffer0, localNdx);
        leftData[i * 2 + 1] = expandFn(buffer1, localNdx);
        localNdx += step;
      }
    }

    this.dstSampleCount += dataLength;
  }

  getSampleForTime(
    time: number,
    context: ByteBeatContext,
    stack: WrappingStack,
    channel = 0
  ): number {
    const divisor = this.expressionType === 3 ? this.getDesiredSampleRate() : 1;
    let s = 0;

    try {
      if (this.functions[0].array) {
        const ss = this.functions[0].f(time / divisor, channel, stack, context, this.extra) as [
          number,
          number
        ];
        s = ss[channel];
      } else {
        if (!this.functions[1]) {
          channel = 0;
        }
        s = this.functions[channel].f(
          time / divisor,
          channel,
          stack,
          context,
          this.extra
        ) as number;
      }

      switch (this.type) {
        case 0:
          return (s & 255) / 127 - 1;
        case 1:
          return s;
        case 2:
          int8[0] = s;
          return int8[0] / 128;
        default:
          return 0;
      }
    } catch (e) {
      console.error(e);
      return 0;
    }
  }
}
