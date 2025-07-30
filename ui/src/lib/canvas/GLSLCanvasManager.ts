import regl from 'regl';
import { GLContextManager } from './GLContextManager';
import { getShadertoyDrawCommand } from './shadertoy-draw';
import { DEFAULT_GLSL_CODE } from './constants';

export class GLSLCanvasManager {
	public width = 500;
	public height = 500;

	private drawCommand: regl.DrawCommand | null = null;
	private frameHandle: regl.Cancellable | null = null;

	private lastTime: number = 0;
	private frameCounter: number = 0;
	private fallbackTexture: regl.Texture2D;
	private code: string = DEFAULT_GLSL_CODE;

	constructor() {
		this.fallbackTexture = this.regl.texture({
			width: 1,
			height: 1,
			data: new Uint8Array([200, 50, 50, 255])
		});
	}

	get regl() {
		return GLContextManager.getInstance().regl;
	}

	updateCode(code: string) {
		this.code = code;
		this.frameHandle?.cancel();

		try {
			this.startRenderLoop();
		} catch (error) {
			console.error('Error updating GLSL code:', error);
		}
	}

	private startRenderLoop() {
		this.drawCommand = getShadertoyDrawCommand({
			code: this.code,
			regl: this.regl,
			lastTime: this.lastTime,
			frameCounter: this.frameCounter,
			mouseX: 0,
			mouseY: 0,
			width: this.width,
			height: this.height,
			textures: [
				this.fallbackTexture,
				this.fallbackTexture,
				this.fallbackTexture,
				this.fallbackTexture
			]
		});

		this.frameHandle = this.regl.frame((context) => {
			this.regl?.clear({ color: [0, 0, 0, 1] });
			this.drawCommand?.(context);

			this.lastTime = context.time;
			this.frameCounter++;
		});
	}
}
