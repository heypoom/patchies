// WebGL context setup for worker environment
import regl from 'regl';
import { WEBGL_EXTENSIONS } from '../../lib/canvas/constants.js';

export class WorkerGLContext {
	/** full render size */
	public renderSize = [800, 600];

	public offscreenCanvas: OffscreenCanvas;
	public gl: WebGLRenderingContext | null = null;
	public regl: regl.Regl;

	private static instance: WorkerGLContext | null = null;

	constructor() {
		const [w, h] = this.renderSize;

		this.offscreenCanvas = new OffscreenCanvas(w, h);
		this.gl = this.offscreenCanvas.getContext('webgl')!;

		if (!this.gl) {
			throw new Error('Failed to get WebGL context in worker');
		}

		this.regl = regl({ gl: this.gl, extensions: WEBGL_EXTENSIONS });
	}

	static getInstance(): WorkerGLContext {
		if (!WorkerGLContext.instance) {
			WorkerGLContext.instance = new WorkerGLContext();
		}

		return WorkerGLContext.instance;
	}
}
