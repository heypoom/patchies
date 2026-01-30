import type {
  DefaultContext,
  DrawCommand,
  DynamicVariable,
  DynamicVariableFn,
  Regl,
  Resource
} from 'regl';
import { Output } from './Output';
import { Loop } from './Loop';
import { Source } from './Source';
import { solid } from './glsl';

export type Precision = 'lowp' | 'mediump' | 'highp';

export type Resolution = readonly [number, number];

export interface HydraFboUniforms {
  resolution: Resolution;
  tex0: Resource;
}

export interface HydraDrawUniforms {
  resolution: Resolution;
  time: number;
}

export interface Synth {
  bpm: number;
  fps?: number;
  resolution: Resolution;
  speed: number;
  stats: {
    fps: number;
  };
  time: number;
}

export interface HydraErrorContext {
  transformName: string;
  transformType: string;
  paramName: string;
  paramIndex: number;
  paramType: string;
}

export type HydraErrorHandler = (error: unknown, context: HydraErrorContext) => void;

export interface GlEnvironment {
  defaultUniforms: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [name: string]: DynamicVariable<any> | DynamicVariableFn<any, any, any>;
  };
  height: number;
  precision: Precision;
  regl: Regl;
  width: number;
  onError?: HydraErrorHandler;
}

interface HydraRendererOptions {
  height: number;
  numOutputs?: number;
  numSources?: number;
  precision?: Precision;
  regl: Regl;
  width: number;
  onError?: HydraErrorHandler;
}

export class Hydra {
  readonly loop: Loop;
  readonly synth: Synth;
  readonly outputs: Output[];
  readonly sources: Source[];
  readonly glEnvironment: GlEnvironment;
  output: Output;
  readonly renderFbo: DrawCommand<DefaultContext>;
  timeSinceLastUpdate = 0;

  constructor({
    height,
    numOutputs = 4,
    numSources = 4,
    precision = 'mediump',
    regl,
    width,
    onError
  }: HydraRendererOptions) {
    const outputs = [];
    const sources = [];

    const synth = {
      bpm: 30,
      fps: undefined,
      resolution: [width, height],
      speed: 1,
      stats: {
        fps: 0
      },
      time: 0
    } as const;

    const defaultUniforms = {
      time: regl.prop<HydraDrawUniforms, keyof HydraDrawUniforms>('time'),
      resolution: regl.prop<HydraDrawUniforms, keyof HydraDrawUniforms>('resolution')
    };

    const glEnvironment: GlEnvironment = {
      regl,
      width,
      height,
      precision,
      defaultUniforms,
      onError
    };

    this.glEnvironment = glEnvironment;

    const renderFbo = regl<HydraFboUniforms>({
      frag: `
      precision ${glEnvironment.precision} float;
      varying vec2 uv;
      uniform vec2 resolution;
      uniform sampler2D tex0;

      void main () {
        gl_FragColor = texture2D(tex0, vec2(1.0 - uv.x, uv.y));
      }
      `,
      vert: `
      precision ${glEnvironment.precision} float;
      attribute vec2 position;
      varying vec2 uv;

      void main () {
        uv = position;
        gl_Position = vec4(1.0 - 2.0 * position, 0, 1);
      }`,
      attributes: {
        position: [
          [-2, 0],
          [0, -2],
          [2, 2]
        ]
      },
      uniforms: {
        tex0: regl.prop<HydraFboUniforms, keyof HydraFboUniforms>('tex0'),
        resolution: regl.prop<HydraFboUniforms, keyof HydraFboUniforms>('resolution')
      },
      count: 3,
      depth: { enable: false }
    });

    for (let i = 0; i < numSources; i++) {
      const s = new Source(glEnvironment);
      sources.push(s);
    }

    for (let i = 0; i < numOutputs; i++) {
      const o = new Output(glEnvironment);
      outputs.push(o);
    }

    this.loop = new Loop(this.tick);
    this.outputs = outputs;
    this.sources = sources;
    this.synth = synth;
    this.output = outputs[0];
    this.renderFbo = renderFbo;
  }

  hush = () => {
    this.outputs.forEach((output) => {
      solid(1, 1, 1, 0).out(output);
    });
  };

  setResolution = (width: number, height: number) => {
    this.synth.resolution = [width, height];

    this.outputs.forEach((output) => {
      output.resize(width, height);
    });
  };

  render = (output?: Output) => {
    this.output = output ?? this.outputs[0];
  };

  // dt in ms
  tick = (dt: number) => {
    this.synth.time += dt * 0.001 * this.synth.speed;

    this.timeSinceLastUpdate += dt;

    if (!this.synth.fps || this.timeSinceLastUpdate >= 1000 / this.synth.fps) {
      this.synth.stats.fps = Math.ceil(1000 / this.timeSinceLastUpdate);

      this.sources.forEach((source) => {
        source.tick();
      });

      this.outputs.forEach((output) => {
        output.tick(this.synth);
      });

      this.renderFbo({
        tex0: this.output.getCurrent(),
        resolution: this.synth.resolution
      });

      this.timeSinceLastUpdate = 0;
    }
  };
}
