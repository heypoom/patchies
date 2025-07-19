export class JSCanvasManager {
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private container: HTMLElement;
	private animationId: number | null = null;

	constructor(container: HTMLElement) {
		this.container = container;
	}

	createCanvas(options: { code: string }) {
		try {
			this.canvas = document.createElement('canvas');
			this.canvas.style.width = '200px';
			this.canvas.style.height = '200px';
			this.canvas.style.objectFit = 'contain';

			// Clear container and add canvas
			this.container.innerHTML = '';
			this.container.appendChild(this.canvas);

			this.setupCanvasSize();
			this.executeCode(options.code);
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

	updateCode(code: string) {
		if (this.canvas && this.ctx) {
			try {
				if (this.animationId) {
					cancelAnimationFrame(this.animationId);
					this.animationId = null;
				}

				this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
				this.executeCode(code);
			} catch (error) {
				console.error('Error updating canvas code:', error);
			}
		}
	}

	private executeCode(code: string) {
		if (!this.canvas || !this.ctx) return;

		try {
			const rect = this.canvas.getBoundingClientRect();

			const context = {
				canvas: this.ctx,
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
				}
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
}
