import regl from 'regl';
import { GLContextManager } from './GLContextManager';
import { getShadertoyDrawCommand } from './shadertoy-draw';
import { DEFAULT_GLSL_CODE } from './constants';

export class GLSLCanvasManager {
	private drawCommand: regl.DrawCommand | null = null;
	private frameHandle: regl.Cancellable | null = null;

	private lastTime: number = 0;
	private frameCounter: number = 0;
	private fallbackTexture: regl.Texture2D;
	private code = DEFAULT_GLSL_CODE;

	constructor() {
		// const [width, height] = this.glContext.size;

		this.fallbackTexture = this.regl.texture({
			width: 1,
			height: 1,
			data: new Uint8Array([1, 1, 1, 1])
		});

		this.startRenderLoop();
	}

	get glContext() {
		return GLContextManager.getInstance();
	}

	get regl() {
		return this.glContext.regl;
	}

	updateCode(code: string) {
		this.code = code;

		try {
			this.startRenderLoop();
		} catch (error) {
			console.error('Error updating GLSL code:', error);
		}
	}

	private startRenderLoop() {
		const [width, height] = this.glContext.size;

		this.frameHandle?.cancel();

		const framebuffer = this.regl.framebuffer({
			color: this.regl.texture({
				width,
				height,
				wrapS: 'clamp',
				wrapT: 'clamp'
			}),
			depthStencil: false
		});

		const drawCommand = getShadertoyDrawCommand({
			code: this.code,
			regl: this.regl,
			framebuffer,
			width,
			height,
			textures: [
				this.fallbackTexture,
				this.fallbackTexture,
				this.fallbackTexture,
				this.fallbackTexture
			]
		});

		const copyCommand = this.regl({
			framebuffer: null,

			vert: `
				precision highp float;

				attribute vec2 position;
				varying vec2 uv;

				void main() {
					uv = 0.5 * (position + 1.0);
					gl_Position = vec4(position, 0, 1);
				}
			`,
			frag: `
				precision highp float;

				uniform sampler2D iChannel0;
				uniform float iTime;
				varying vec2 uv;

				void main() {
					gl_FragColor = texture2D(iChannel0, uv);
				}
			`,
			attributes: {
				position: [
					[-1, -1],
					[1, -1],
					[-1, 1],
					[1, 1]
				]
			},
			uniforms: {
				iChannel0: framebuffer,
				iTime: ({ time }) => time,
				iResolution: ({ pixelRatio }) => {
					return [width * pixelRatio, height * pixelRatio, 1.0];
				}
			},
			primitive: 'triangle strip',
			count: 4
		});

		this.frameHandle = this.regl.frame((context) => {
			drawCommand({
				lastTime: this.lastTime,
				frameCounter: this.frameCounter,
				mouseX: 0,
				mouseY: 0
			});

			copyCommand();

			this.lastTime = context.time;
			this.frameCounter += 1;
		});
	}
}
