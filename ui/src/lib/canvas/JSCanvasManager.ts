import { GLSystem } from './GLSystem';

interface SendMessageOptions {
	type?: string;
	to?: string;
}

interface MessageContext {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	send: (data: any, options?: SendMessageOptions) => void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	onMessage: (callback: (message: any) => void) => void;
	interval: (callback: () => void, ms: number) => number;

	noDrag: () => void;
}

export interface JSCanvasConfig {
	code: string;
	messageContext?: MessageContext;
}

export class JSCanvasManager {
	private glSystem = GLSystem.getInstance();
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;

	private animationId: number | null = null;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d')!;
	}

	createCanvas(options: JSCanvasConfig) {
		try {
			const [previewWidth, previewHeight] = this.glSystem.previewSize;
			const dpr = window.devicePixelRatio || 1;

			this.canvas.width = previewWidth * dpr;
			this.canvas.height = previewHeight * dpr;
			this.canvas.style.width = `${previewWidth}px`;
			this.canvas.style.height = `${previewHeight}px`;

			this.runCode(options);
		} catch (error) {
			console.error('Error creating canvas:', error);
		}
	}

	runCode(options: JSCanvasConfig) {
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
					this.animationId = requestAnimationFrame(callback);

					return this.animationId;
				},

				cancelAnimationFrame: (id: number) => {
					cancelAnimationFrame(id);

					if (this.animationId === id) {
						this.animationId = null;
					}
				},

				// Message system functions (if available)
				...(messageContext && {
					send: messageContext.send,
					onMessage: messageContext.onMessage,
					interval: messageContext.interval,
					noDrag: messageContext.noDrag
				})
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
