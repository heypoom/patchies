import regl from 'regl';
import { WEBGL_EXTENSIONS } from './constants';

export class GLContextManager {
	private static instance: GLContextManager | null = null;

	public offscreenCanvas: OffscreenCanvas;
	public gl: WebGLRenderingContext | null = null;
	public regl: regl.Regl;

	constructor() {
		this.offscreenCanvas = new OffscreenCanvas(500, 500);
		this.gl = this.offscreenCanvas.getContext('webgl')!;

		this.regl = regl({
			gl: this.gl,
			extensions: WEBGL_EXTENSIONS
		});
	}

	static getInstance(): GLContextManager {
		if (!GLContextManager.instance) GLContextManager.instance = new GLContextManager();

		return GLContextManager.instance;
	}
}
