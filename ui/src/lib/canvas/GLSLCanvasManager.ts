import regl from 'regl';

export class GLSLCanvasManager {
	public width = 800;
	public height = 800;

	private canvas: HTMLCanvasElement | null = null;
	private regl: regl.Regl | null = null;
	private container: HTMLElement;
	private drawCommand: regl.DrawCommand | null = null;
	private frameHandle: regl.Cancellable | null = null;
	private mouseX: number = 0;
	private mouseY: number = 0;
	private dpr = window.devicePixelRatio || 1;

	// Video canvas sources and textures for iChannel0-3
	private videoCanvases: HTMLCanvasElement[] = [];
	private videoTextures: regl.Texture2D[] = [];
	private fallbackTexture: regl.Texture2D | null = null;

	private date = new Date();

	constructor(container: HTMLElement) {
		this.container = container;
	}

	createCanvas(options: { code: string }) {
		try {
			this.canvas = document.createElement('canvas');
			this.canvas.style.width = '200px';
			this.canvas.style.height = '200px';
			this.canvas.style.objectFit = 'contain';

			this.container.innerHTML = '';
			this.container.appendChild(this.canvas);

			// Wait a frame for the canvas to be laid out properly
			requestAnimationFrame(() => {
				try {
					this.setupCanvasSize();
					this.setupRegl();
					this.setupMouseTracking();
					this.createShaderProgram(options.code);
					this.startRenderLoop();
				} catch (error) {
					console.error('Error in delayed canvas setup:', error);

					if (error instanceof Error) {
						this.showError(error.message);
					}
				}
			});
		} catch (error) {
			console.error('Error creating GLSL canvas:', error);
			if (error instanceof Error) {
				this.container.innerHTML = `<div class="text-red-400 text-xs p-2">Error: ${error.message}</div>`;
			}
		}
	}

	private setupCanvasSize() {
		if (!this.canvas) return;

		const dpr = window.devicePixelRatio || 1;
		const rect = this.canvas.getBoundingClientRect();

		// Ensure we have valid dimensions
		if (rect.width === 0 || rect.height === 0) {
			console.warn('Canvas has zero dimensions, using fallback');
			this.canvas.width = this.width * dpr;
			this.canvas.height = this.height * dpr;
		} else {
			this.canvas.width = this.width * dpr;
			this.canvas.height = this.height * dpr;
		}
	}

	private setupRegl() {
		if (!this.canvas) return;

		this.regl = regl({
			canvas: this.canvas,
			extensions: ['OES_texture_float']
		});

		// Create a fallback texture with black pixels to avoid "missing image data" errors
		this.fallbackTexture = this.regl.texture({
			width: 1,
			height: 1,
			data: new Uint8Array([0, 0, 0, 255]) // Black pixel
		});
	}

	private setupMouseTracking() {
		if (!this.canvas) return;

		this.canvas.addEventListener('mousemove', (e) => {
			const rect = this.canvas!.getBoundingClientRect();

			this.mouseX = e.clientX - rect.left;
			this.mouseY = rect.height - (e.clientY - rect.top);
		});
	}

	updateCode(code: string) {
		const existingError = this.container.querySelector('.glsl-error-overlay');

		if (existingError) {
			existingError.remove();
		}

		if (this.regl) {
			try {
				// Stop current render loop
				if (this.frameHandle) {
					this.frameHandle.cancel();
					this.frameHandle = null;
				}

				this.createShaderProgram(code);
				this.startRenderLoop();
			} catch (error) {
				console.error('Error updating GLSL code:', error);

				this.showError(error instanceof Error ? error.message : 'Unknown shader error');
			}
		}
	}

	private createShaderProgram(fragmentShaderCode: string) {
		if (!this.regl) return;

		// Vertex shader (simple quad)
		const vertexShader = `
			precision mediump float;
			attribute vec2 position;
			void main() {
				gl_Position = vec4(position, 0, 1);
			}
		`;

		// Fragment shader with ShaderToy-compatible uniforms and textures
		const fragmentShader = `
			precision mediump float;
			
			uniform vec3 iResolution;
			uniform float iTime;
			uniform vec4 iMouse;
			uniform vec4 iDate;
			uniform float iTimeDelta;
			uniform int iFrame;
			
			// Video textures for iChannel0-3
			uniform sampler2D iChannel0;
			uniform sampler2D iChannel1;
			uniform sampler2D iChannel2;
			uniform sampler2D iChannel3;
			
			${fragmentShaderCode}
			
			void main() {
				vec4 fragColor = vec4(0.0);
				mainImage(fragColor, gl_FragCoord.xy);
				gl_FragColor = fragColor;
			}
		`;

		this.drawCommand = this.regl({
			frag: fragmentShader,
			vert: vertexShader,

			attributes: {
				position: this.regl.buffer([
					[-1, -1],
					[1, -1],
					[-1, 1],
					[1, 1]
				])
			},

			uniforms: {
				iResolution: () => {
					return [this.width * this.dpr, this.height * this.dpr, 1.0];
				},

				iTime: ({ time }) => time,

				iMouse: () => [this.mouseX, this.mouseY, 0, 0],

				iDate: () => {
					return [
						this.date.getFullYear(),
						this.date.getMonth(),
						this.date.getDate(),
						this.date.getHours() * 3600 + this.date.getMinutes() * 60 + this.date.getSeconds()
					];
				},

				iTimeDelta: ({ tick }) => tick * 0.001,

				iFrame: ({ tick }) => tick,

				// Video texture uniforms
				iChannel0: () => this.videoTextures[0] || this.fallbackTexture,
				iChannel1: () => this.videoTextures[1] || this.fallbackTexture,
				iChannel2: () => this.videoTextures[2] || this.fallbackTexture,
				iChannel3: () => this.videoTextures[3] || this.fallbackTexture
			},

			primitive: 'triangle strip',
			count: 4
		});
	}

	private startRenderLoop() {
		if (!this.regl || !this.drawCommand) {
			console.error('Cannot start render loop - missing regl or draw command');
			return;
		}

		// Start the render loop

		this.frameHandle = this.regl.frame((context) => {
			this.updateVideoTextures();

			// Clear the screen
			this.regl!.clear({
				color: [0, 0, 0, 1],
				depth: 1
			});

			this.drawCommand!(context);
		});
	}

	private updateVideoTextures() {
		if (!this.regl) return;

		for (let i = 0; i < this.videoCanvases.length && i < 4; i++) {
			const canvas = this.videoCanvases[i];

			// Check if canvas has valid dimensions
			if (canvas && canvas.width > 0 && canvas.height > 0) {
				try {
					if (!this.videoTextures[i]) {
						// Create texture if it doesn't exist
						this.videoTextures[i] = this.regl.texture({
							data: canvas,
							flipY: true
						});
					} else {
						// Update existing texture
						this.videoTextures[i].subimage({
							data: canvas
						});
					}
				} catch (error) {
					console.warn(`Failed to update canvas texture ${i}:`, error);

					// Clear the problematic texture
					if (this.videoTextures[i]) {
						this.videoTextures[i].destroy();
						this.videoTextures[i] = null as any;
					}
				}
			}
		}
	}

	private showError(message: string) {
		// Create error overlay
		const errorDiv = document.createElement('div');

		errorDiv.className =
			'glsl-error-overlay absolute inset-0 bg-zinc-900 bg-opacity-50 flex items-center justify-center px-2';

		errorDiv.innerHTML = `
			<div class="bg-red-900 border border-red-600 rounded-lg px-2 py-1 max-w-full">
				<div class="font-mono text-[8px] text-red-200 whitespace-pre-wrap break-words">${this.escapeHtml(message)}</div>
			</div>
		`;

		// Remove existing error overlay
		const existingError = this.container.querySelector('.glsl-error-overlay');
		if (existingError) {
			existingError.remove();
		}

		this.container.appendChild(errorDiv);
	}

	private escapeHtml(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	destroy() {
		// Stop render loop
		if (this.frameHandle) {
			this.frameHandle.cancel();
			this.frameHandle = null;
		}

		// Clean up video textures
		this.cleanupVideoTextures();

		// Clean up fallback texture
		if (this.fallbackTexture) {
			this.fallbackTexture.destroy();
			this.fallbackTexture = null;
		}

		// Clean up regl
		if (this.regl) {
			this.regl.destroy();
			this.regl = null;
		}

		if (this.canvas) {
			this.canvas.remove();
			this.canvas = null;
		}

		// Clear container
		this.container.innerHTML = '';
	}

	getCanvas(): HTMLCanvasElement | null {
		return this.canvas;
	}

	setVideoCanvases(canvases: HTMLCanvasElement[]) {
		// Clean up existing textures
		this.cleanupVideoTextures();

		this.videoCanvases = canvases.slice(0, 4); // Only take first 4 canvases for iChannel0-3
	}

	private cleanupVideoTextures() {
		// Clear canvas references
		this.videoCanvases = [];

		// Clean up regl textures
		for (const texture of this.videoTextures) {
			if (texture) {
				texture.destroy();
			}
		}
		this.videoTextures = [];
	}
}
