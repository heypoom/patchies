import type { Attributes, DrawCommand, Framebuffer2D } from 'regl';
import type { GlEnvironment, Synth } from './Hydra';
import type { TransformApplication } from './glsl/Glsl';
import { compileWithEnvironment } from './compiler/compileWithEnvironment';

export class Output {
  attributes: Attributes;
  _draw: DrawCommand;
  fbos: Framebuffer2D[];
  environment: GlEnvironment;
  vert: string;
  pingPongIndex = 0;

  constructor(environment: GlEnvironment) {
    this.environment = environment;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this._draw = () => {};

    this.vert = `
  precision ${environment.precision} float;
  attribute vec2 position;
  varying vec2 uv;

  void main () {
    uv = position;
    gl_Position = vec4(2.0 * position - 1.0, 0, 1);
  }`;

    this.attributes = {
      position: environment.regl.buffer([
        [-2, 0],
        [0, -2],
        [2, 2]
      ])
    };

    // for each output, create two fbos for pingponging
    this.fbos = Array(2)
      .fill(undefined)
      .map(() =>
        environment.regl.framebuffer({
          color: environment.regl.texture({
            mag: 'nearest',
            width: environment.width,
            height: environment.height,
            format: 'rgba'
          }),
          depthStencil: false
        })
      );
  }

  resize(width: number, height: number) {
    this.fbos.forEach((fbo) => {
      fbo.resize(width, height);
    });
  }

  getCurrent() {
    return this.fbos[this.pingPongIndex];
  }

  // Used by glsl-utils/formatArguments
  getTexture() {
    const index = this.pingPongIndex ? 0 : 1;
    return this.fbos[index];
  }

  tick(synth: Synth) {
    try {
      this._draw(synth);
    } catch (error) {
      if (this.environment.onError) {
        this.environment.onError(error, {
          transformName: 'draw',
          transformType: 'render',
          paramName: 'output',
          paramIndex: 0,
          paramType: 'framebuffer'
        });
      }
    }
  }

  render(transformApplications: TransformApplication[]) {
    if (transformApplications.length === 0) {
      return;
    }

    const pass = compileWithEnvironment(transformApplications, this.environment);

    this._draw = this.environment.regl({
      frag: pass.frag,
      vert: this.vert,
      attributes: this.attributes,
      uniforms: pass.uniforms,
      count: 3,
      framebuffer: () => {
        this.pingPongIndex = this.pingPongIndex ? 0 : 1;

        return this.fbos[this.pingPongIndex];
      }
    });
  }
}
