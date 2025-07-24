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
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private container: HTMLElement;
	private animationId: number | null = null;
	private videoCanvas: HTMLCanvasElement | null = null;

	constructor(container: HTMLElement) {
		this.container = container;
	}

	createCanvas(options: JSCanvasConfig) {
		try {
			this.canvas = document.createElement('canvas');
			this.canvas.style.width = '200px';
			this.canvas.style.height = '200px';
			this.canvas.style.objectFit = 'contain';

			// Clear container and add canvas
			this.container.innerHTML = '';
			this.container.appendChild(this.canvas);

			this.setupCanvasSize();
			const codeString = options.code;
			const messageContext = 'messageContext' in options ? options.messageContext : undefined;
			this.executeCode(codeString, messageContext);
		} catch (error) {
			console.error('Error creating canvas:', error);
			if (error instanceof Error) {
				this.container.innerHTML = `<div class="text-red-400 text-xs p-2">Error: ${error.message}</div>`;
			}
		}
	}

	private setupCanvasSize() {
		if (!this.canvas) return;

		const dpr = window.devicePixelRatio || 1;
		const rect = this.canvas.getBoundingClientRect();
		this.canvas.width = rect.width * dpr;
		this.canvas.height = rect.height * dpr;

		this.ctx = this.canvas.getContext('2d');
		if (!this.ctx) {
			throw new Error('Could not get 2D context');
		}

		this.ctx.scale(dpr, dpr);
	}

	updateCode(options: JSCanvasConfig | string) {
		if (this.canvas && this.ctx) {
			try {
				if (this.animationId) {
					cancelAnimationFrame(this.animationId);
					this.animationId = null;
				}

				this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
				const codeString = typeof options === 'string' ? options : options.code;
				const messageContext = typeof options === 'string' ? undefined : options.messageContext;
				this.executeCode(codeString, messageContext);
			} catch (error) {
				console.error('Error updating canvas code:', error);
			}
		}
	}

	private executeCode(code: string, messageContext?: MessageContext) {
		if (!this.canvas || !this.ctx) return;

		try {
			const rect = this.canvas.getBoundingClientRect();

			const context = {
				canvas: this.canvas,
				ctx: this.ctx,
				width: rect.width,
				height: rect.height,

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

				// Video chaining function
				fromCanvas: this.createFromCanvasFunction(),

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
		// Stop any running animation
		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}

		if (this.canvas) {
			this.canvas.remove();
			this.canvas = null;
		}

		this.ctx = null;

		// Clear container
		this.container.innerHTML = '';
	}

	getCanvas(): HTMLCanvasElement | null {
		return this.canvas;
	}

	setVideoCanvas(canvas: HTMLCanvasElement | null) {
		this.videoCanvas = canvas;
	}

	private createFromCanvasFunction() {
		return () => {
			if (this.videoCanvas) {
				// Return the canvas element for direct drawing with ctx.drawImage(canvas, 0, 0)
				return this.videoCanvas;
			}
			return null;
		};
	}
}
