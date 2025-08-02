import { Hydra, generators } from 'hydra-ts';
import regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { HydraFboUniforms } from 'hydra-ts/src/Hydra';
import type { RenderParams } from '$lib/rendering/types';

export interface HydraConfig {
	code: string;
}

export class HydraRenderer {
	public config: HydraConfig;
	public hydra: Hydra;
	public renderer: FBORenderer;
	public precision: 'highp' | 'mediump' = 'highp';
	public renderFboCommand: regl.DrawCommand<regl.DefaultContext, HydraFboUniforms>;
	public framebuffer: regl.Framebuffer2D | null = null;

	private timestamp = performance.now();

	constructor(config: HydraConfig, framebuffer: regl.Framebuffer2D, renderer: FBORenderer) {
		this.config = config;
		this.framebuffer = framebuffer;
		this.renderer = renderer;

		const [width, height] = this.renderer.outputSize;

		// Initialize Hydra in non-global mode
		this.hydra = new Hydra({
			// @ts-expect-error -- regl version mismatch, but should still work!
			regl: this.renderer.regl,
			width,
			height,
			numSources: 4,
			numOutputs: 4,
			precision: this.precision
		});

		this.updateCode();

		this.renderFboCommand = this.renderer.regl({
			framebuffer: this.framebuffer,
			frag: `
      precision ${this.precision} float;
      varying vec2 uv;
      uniform vec2 resolution;
      uniform sampler2D tex0;

      void main () {
        gl_FragColor = texture2D(tex0, vec2(1.0 - uv.x, uv.y));
      }
      `,
			vert: `
      precision ${this.precision} float;
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
				tex0: this.renderer.regl.prop<HydraFboUniforms, keyof HydraFboUniforms>('tex0'),
				resolution: this.renderer.regl.prop<HydraFboUniforms, keyof HydraFboUniforms>('resolution')
			},
			count: 3,
			depth: { enable: false }
		});
	}

	renderFrame(params: RenderParams) {
		const time = performance.now();
		const deltaTime = time - this.timestamp;

		this.hydra.synth.time += deltaTime * 0.001 * this.hydra.synth.speed;
		this.hydra.timeSinceLastUpdate += deltaTime;

		this.hydra.sources.forEach((source) => {
			source.tick(this.hydra.synth);
		});

		this.hydra.outputs.forEach((output) => {
			output.tick(this.hydra.synth);
		});

		// TODO: replace this with direct framebuffer blit instead of regl draw command!
		this.renderFboCommand({
			tex0: this.hydra.output.getCurrent(),
			resolution: this.hydra.synth.resolution
		});

		this.hydra.timeSinceLastUpdate = 0;
		this.timestamp = time;
	}

	private updateCode() {
		try {
			const { src, osc, gradient, shape, voronoi, noise, solid } = generators;
			const { sources, outputs, hush, render } = this.hydra;

			const [s0, s1, s2, s3] = sources;
			const [o0, o1, o2, o3] = outputs;

			// Clear any existing patterns
			this.stop();

			// Create a context with Hydra synth instance available as 'h'
			// Also destructure common functions for easier access
			const context = {
				h: this.hydra.synth,
				render,
				hush,

				// Generators
				osc,
				gradient,
				shape,
				voronoi,
				noise,
				src,
				solid,

				// Sources
				s0,
				s1,
				s2,
				s3,

				// Outputs
				o0,
				o1,
				o2,
				o3
			};

			const userFunction = new Function(
				'context',
				`
				let time = performance.now()

				with (context) {
					${this.config.code}
				}
			`
			);

			userFunction(context);
		} catch (error) {
			console.error('Error executing Hydra code:', error);
			throw error;
		}
	}

	stop() {
		this.hydra.hush();
		for (const source of this.hydra.sources) source.clear();
	}

	destroy() {
		this.stop();

		// Destroy all sources and outputs
		for (const source of this.hydra.sources) {
			source.getTexture()?.destroy();
		}

		for (const output of this.hydra.outputs) {
			output.fbos.forEach((fbo) => fbo.destroy());
		}
	}
}
