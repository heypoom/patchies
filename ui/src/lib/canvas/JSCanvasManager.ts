import type { UserFnRunContext } from '$lib/messages/MessageContext';
import { GLSystem } from './GLSystem';

export interface JSCanvasConfig {
	code: string;
	messageContext?: UserFnRunContext;
}

export class JSCanvasManager {
	public nodeId: string;
	public glSystem = GLSystem.getInstance();
	public canvas: HTMLCanvasElement;
	public ctx: CanvasRenderingContext2D;

	private animationId: number | null = null;

	constructor(nodeId: string, canvas: HTMLCanvasElement) {
		this.nodeId = nodeId;
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d')!;
	}

	setupSketch(options: JSCanvasConfig) {
		try {
			const [previewWidth, previewHeight] = this.glSystem.previewSize;
			const dpr = window.devicePixelRatio || 1;

			this.canvas.width = previewWidth * dpr;
			this.canvas.height = previewHeight * dpr;
			this.canvas.style.width = `${previewWidth}px`;
			this.canvas.style.height = `${previewHeight}px`;

			this.updateSketch(options);
		} catch (error) {
			console.error('Error creating canvas:', error);
		}
	}

	updateSketch(options: JSCanvasConfig) {
		if (!this.canvas || !this.ctx) return;

		const { code, messageContext } = options;

		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		try {
			const context = {
				canvas: this.canvas,
				ctx: this.ctx,
				width: this.canvas.width,
				height: this.canvas.height,

				requestAnimationFrame: (callback: FrameRequestCallback) => {
					if (this.glSystem.hasOutgoingVideoConnections(this.nodeId)) {
						this.glSystem.setBitmapSource(this.nodeId, this.canvas);
					}

					this.animationId = requestAnimationFrame(callback);

					return this.animationId;
				},

				cancelAnimationFrame: (id: number) => {
					cancelAnimationFrame(id);

					if (this.animationId === id) {
						this.animationId = null;
					}
				},

				...messageContext
			};

			const functionParams = Object.keys(context);
			const functionArgs = Object.values(context);

			const executeFunction = new Function(...functionParams, code);
			executeFunction(...functionArgs);
		} catch (error) {
			console.error('Error executing canvas code:', error);
			throw error;
		}
	}

	destroy() {
		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}

		this.canvas?.remove();
	}
}
