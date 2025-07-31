// WebGL context setup for worker environment
import regl from 'regl';
import { WEBGL_EXTENSIONS } from '../../lib/canvas/constants.js';

export class WorkerGLContext {
	private static instance: WorkerGLContext | null = null;

	public offscreenCanvas: OffscreenCanvas;
	public outputCanvas: OffscreenCanvas; // Separate canvas for output transfers
	public gl: WebGLRenderingContext | null = null;
	public outputGL: WebGLRenderingContext | null = null;
	public regl: regl.Regl;
	public outputRegl: regl.Regl;
	public size = [800, 600]; // Default size, can be updated

	constructor() {
		const [w, h] = this.size;

		// Main rendering canvas
		this.offscreenCanvas = new OffscreenCanvas(w, h);
		this.gl = this.offscreenCanvas.getContext('webgl')!;

		if (!this.gl) {
			throw new Error('Failed to get WebGL context in worker');
		}

		this.regl = regl({
			gl: this.gl,
			extensions: WEBGL_EXTENSIONS
		});

		// Separate output canvas for transfers (doesn't get consumed)
		this.outputCanvas = new OffscreenCanvas(w, h);
		this.outputGL = this.outputCanvas.getContext('webgl')!;

		if (!this.outputGL) {
			throw new Error('Failed to get output WebGL context in worker');
		}

		this.outputRegl = regl({
			gl: this.outputGL,
			extensions: WEBGL_EXTENSIONS
		});

		console.log('Worker GL context initialized:', {
			size: this.size,
			extensions: WEBGL_EXTENSIONS
		});
	}

	static getInstance(): WorkerGLContext {
		if (!WorkerGLContext.instance) {
			WorkerGLContext.instance = new WorkerGLContext();
		}
		return WorkerGLContext.instance;
	}

	resize(width: number, height: number) {
		this.size = [width, height];
		this.offscreenCanvas.width = width;
		this.offscreenCanvas.height = height;
		this.outputCanvas.width = width;
		this.outputCanvas.height = height;
		this.gl?.viewport(0, 0, width, height);
		this.outputGL?.viewport(0, 0, width, height);
	}
}