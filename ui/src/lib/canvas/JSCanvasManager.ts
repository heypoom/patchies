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
			// Create canvas element
			this.canvas = document.createElement('canvas');
			this.canvas.width = 200;
			this.canvas.height = 200;
			this.canvas.style.width = '100%';
			this.canvas.style.height = '100%';
			this.canvas.style.objectFit = 'contain';
			
			// Get 2D context
			this.ctx = this.canvas.getContext('2d');
			if (!this.ctx) {
				throw new Error('Could not get 2D context');
			}

			// Clear container and add canvas
			this.container.innerHTML = '';
			this.container.appendChild(this.canvas);

			// Execute the user code
			this.executeCode(options.code);
		} catch (error) {
			console.error('Error creating canvas:', error);
			if (error instanceof Error) {
				this.container.innerHTML = `<div class="text-red-400 text-xs p-2">Error: ${error.message}</div>`;
			}
		}
	}

	updateCode(code: string) {
		if (this.canvas && this.ctx) {
			try {
				// Stop any existing animation
				if (this.animationId) {
					cancelAnimationFrame(this.animationId);
					this.animationId = null;
				}
				
				// Clear canvas
				this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
				
				// Execute new code
				this.executeCode(code);
			} catch (error) {
				console.error('Error updating canvas code:', error);
			}
		}
	}

	private executeCode(code: string) {
		if (!this.canvas || !this.ctx) return;

		try {
			// Create a context with canvas variables available
			const context = {
				canvas: this.ctx,
				ctx: this.ctx,
				width: this.canvas.width,
				height: this.canvas.height,
				// Animation utilities
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

			// Execute the user's canvas code with the context
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