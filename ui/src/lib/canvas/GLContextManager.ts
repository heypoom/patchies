import regl from 'regl';
import { WEBGL_EXTENSIONS } from './constants';

export class GLContextManager {
	private static instance: GLContextManager | null = null;

	public offscreenCanvas: OffscreenCanvas;
	public gl: WebGLRenderingContext | null = null;
	public regl: regl.Regl;
	public size = [500, 500];

	constructor() {
		const [w, h] = this.size;

		this.offscreenCanvas = new OffscreenCanvas(w, h);
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
