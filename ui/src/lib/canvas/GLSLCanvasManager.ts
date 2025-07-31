import regl from 'regl';
import { GLContextManager } from './GLContextManager';
import { DrawToFbo } from './shadertoy-draw';
import { DEFAULT_GLSL_CODE } from './constants';

export class GLSLCanvasManager {
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

		const nodeAframebuffer = this.regl.framebuffer({
			color: this.regl.texture({
				width,
				height,
				wrapS: 'clamp',
				wrapT: 'clamp'
			}),
			depthStencil: false
		});

		const nodeA = DrawToFbo({
			code: this.code,
			regl: this.regl,
			framebuffer: nodeAframebuffer,
			width,
			height
		});

		const nodeB = DrawToFbo({
			code: `
				void mainImage(out vec4 fragColor, in vec2 fragCoord) {
					fragColor = texture2D(iChannel0, uv);
				}
			`,
			regl: this.regl,
			framebuffer: null,
			width,
			height
		});

		this.frameHandle = this.regl.frame((context) => {
			nodeAframebuffer.use(() => {
				nodeA({
					lastTime: this.lastTime,
					frameCounter: this.frameCounter,
					mouseX: 0,
					mouseY: 0,
					textures: [
						this.fallbackTexture,
						this.fallbackTexture,
						this.fallbackTexture,
						this.fallbackTexture
					]
				});
			});

			nodeB({
				lastTime: this.lastTime,
				frameCounter: this.frameCounter,
				mouseX: 0,
				mouseY: 0,
				textures: [
					nodeAframebuffer,
					this.fallbackTexture,
					this.fallbackTexture,
					this.fallbackTexture
				]
			});

			this.lastTime = context.time;
			this.frameCounter += 1;
		});
	}
}
