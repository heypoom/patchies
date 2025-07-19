export class GLSLCanvasManager {
	private canvas: HTMLCanvasElement | null = null;
	private gl: WebGLRenderingContext | null = null;
	private container: HTMLElement;
	private program: WebGLProgram | null = null;
	private animationId: number | null = null;
	private startTime: number = Date.now();
	private mouseX: number = 0;
	private mouseY: number = 0;

	// Uniform locations
	private uniforms: { [key: string]: WebGLUniformLocation | null } = {};

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

					this.canvas!.addEventListener('mousemove', (e) => {
						const rect = this.canvas!.getBoundingClientRect();
						this.mouseX = e.clientX - rect.left;
						this.mouseY = rect.height - (e.clientY - rect.top);
					});

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
			this.canvas.width = 200 * dpr;
			this.canvas.height = 200 * dpr;
		} else {
			this.canvas.width = rect.width * dpr;
			this.canvas.height = rect.height * dpr;
		}


		this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');

		if (!this.gl) {
			throw new Error('WebGL not supported');
		}
	}

	updateCode(code: string) {
		if (this.gl) {
			try {
				// Stop current animation
				if (this.animationId) {
					cancelAnimationFrame(this.animationId);
					this.animationId = null;
				}

				// Create new shader program
				this.createShaderProgram(code);

				// Restart render loop
				this.startRenderLoop();
			} catch (error) {
				console.error('Error updating GLSL code:', error);
				// Show error in UI
				this.showError(error instanceof Error ? error.message : 'Unknown shader error');
			}
		}
	}

	private createShaderProgram(fragmentShaderCode: string) {
		if (!this.gl) return;

		console.log('Creating shader program...');

		// Vertex shader (simple quad)
		const vertexShaderSource = `
			attribute vec4 a_position;
			void main() {
				gl_Position = a_position;
			}
		`;

		// Fragment shader with ShaderToy-compatible uniforms
		const fragmentShaderSource = `
			precision mediump float;
			
			uniform vec3 iResolution;
			uniform float iTime;
			uniform vec4 iMouse;
			uniform vec4 iDate;
			uniform float iTimeDelta;
			uniform int iFrame;
			
			${fragmentShaderCode}
			
			void main() {
				vec4 fragColor = vec4(0.0);
				mainImage(fragColor, gl_FragCoord.xy);
				gl_FragColor = fragColor;
			}
		`;

		// Compile shaders
		const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
		const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);

		if (!vertexShader || !fragmentShader) {
			throw new Error('Failed to compile shaders');
		}


		// Create program
		const program = this.gl.createProgram();
		if (!program) {
			throw new Error('Failed to create shader program');
		}

		this.gl.attachShader(program, vertexShader);
		this.gl.attachShader(program, fragmentShader);
		this.gl.linkProgram(program);

		if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
			const error = this.gl.getProgramInfoLog(program);
			this.gl.deleteProgram(program);
			throw new Error('Failed to link shader program: ' + error);
		}


		// Clean up old program
		if (this.program) {
			this.gl.deleteProgram(this.program);
		}

		this.program = program;
		this.gl.useProgram(this.program);

		// Set up geometry (full-screen quad)
		this.setupGeometry();

		// Get uniform locations
		this.getUniformLocations();

	}

	private compileShader(source: string, type: number): WebGLShader | null {
		if (!this.gl) return null;

		const shader = this.gl.createShader(type);
		if (!shader) return null;

		this.gl.shaderSource(shader, source);
		this.gl.compileShader(shader);

		if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
			const error = this.gl.getShaderInfoLog(shader);
			console.error('Shader compilation error:', error);
			this.gl.deleteShader(shader);
			throw new Error('Shader compilation error: ' + error);
		}

		return shader;
	}

	private setupGeometry() {
		if (!this.gl || !this.program) return;

		// Create buffer for full-screen quad
		const positionBuffer = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);

		const positions = [-1, -1, 1, -1, -1, 1, 1, 1];

		this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

		// Set up attribute
		const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
		this.gl.enableVertexAttribArray(positionLocation);
		this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
	}

	private getUniformLocations() {
		if (!this.gl || !this.program) return;

		this.uniforms = {
			iResolution: this.gl.getUniformLocation(this.program, 'iResolution'),
			iTime: this.gl.getUniformLocation(this.program, 'iTime'),
			iMouse: this.gl.getUniformLocation(this.program, 'iMouse'),
			iDate: this.gl.getUniformLocation(this.program, 'iDate'),
			iTimeDelta: this.gl.getUniformLocation(this.program, 'iTimeDelta'),
			iFrame: this.gl.getUniformLocation(this.program, 'iFrame')
		};
	}

	private startRenderLoop() {
		if (!this.gl || !this.program) {
			console.error('Cannot start render loop - missing GL or program');
			return;
		}

		this.startTime = performance.now();
		let frameCount = 0;
		let lastTime = 0;

		const render = (currentTime: number) => {
			if (!this.gl || !this.canvas || !this.program) return;

			const time = (currentTime - this.startTime) * 0.001;
			const timeDelta = currentTime - lastTime;
			lastTime = currentTime;

			// Set viewport - use actual canvas dimensions
			this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

			// Clear
			this.gl.clearColor(0, 0, 0, 1);
			this.gl.clear(this.gl.COLOR_BUFFER_BIT);

			// Use the shader program
			this.gl.useProgram(this.program);

			// Get CSS dimensions for shader resolution uniform
			const rect = this.canvas.getBoundingClientRect();

			// Set uniforms
			if (this.uniforms.iResolution) {
				// Use CSS dimensions for iResolution to match ShaderToy behavior
				this.gl.uniform3f(this.uniforms.iResolution, rect.width, rect.height, 1.0);
			}

			if (this.uniforms.iTime) {
				this.gl.uniform1f(this.uniforms.iTime, time);
			}

			if (this.uniforms.iMouse) {
				this.gl.uniform4f(this.uniforms.iMouse, this.mouseX, this.mouseY, 0, 0);
			}

			if (this.uniforms.iDate) {
				const date = new Date();
				this.gl.uniform4f(
					this.uniforms.iDate,
					date.getFullYear(),
					date.getMonth(),
					date.getDate(),
					date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()
				);
			}

			if (this.uniforms.iTimeDelta) {
				this.gl.uniform1f(this.uniforms.iTimeDelta, timeDelta * 0.001);
			}

			if (this.uniforms.iFrame) {
				this.gl.uniform1i(this.uniforms.iFrame, frameCount);
			}

			// Draw the full screen quad
			this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

			// Check for GL errors
			const error = this.gl.getError();
			if (error !== this.gl.NO_ERROR) {
				console.error('WebGL error during render:', error, this.getGLErrorString(error));
			}

			frameCount++;
			this.animationId = requestAnimationFrame(render);
		};

		this.animationId = requestAnimationFrame(render);
	}

	private getGLErrorString(error: number): string {
		if (!this.gl) return 'Unknown';
		switch (error) {
			case this.gl.INVALID_ENUM:
				return 'INVALID_ENUM';
			case this.gl.INVALID_VALUE:
				return 'INVALID_VALUE';
			case this.gl.INVALID_OPERATION:
				return 'INVALID_OPERATION';
			case this.gl.OUT_OF_MEMORY:
				return 'OUT_OF_MEMORY';
			case this.gl.CONTEXT_LOST_WEBGL:
				return 'CONTEXT_LOST_WEBGL';
			default:
				return `Unknown error: ${error}`;
		}
	}

	private showError(message: string) {
		// Create error overlay
		const errorDiv = document.createElement('div');
		errorDiv.className =
			'absolute inset-0 bg-zinc-900 bg-opacity-90 flex items-center justify-center p-4';
		errorDiv.innerHTML = `
			<div class="bg-red-900 border border-red-600 rounded-lg p-3 max-w-full">
				<div class="font-mono text-xs font-medium text-red-100 mb-1">GLSL Compilation Error:</div>
				<div class="font-mono text-xs text-red-200 whitespace-pre-wrap break-words">${this.escapeHtml(message)}</div>
			</div>
		`;

		// Remove existing error overlay
		const existingError = this.container.querySelector('.absolute.inset-0');
		if (existingError) {
			existingError.remove();
		}

		// Position container relatively if not already
		if (getComputedStyle(this.container).position === 'static') {
			this.container.style.position = 'relative';
		}

		this.container.appendChild(errorDiv);
	}

	private escapeHtml(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	destroy() {
		// Stop animation
		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}

		// Clean up WebGL resources
		if (this.gl && this.program) {
			this.gl.deleteProgram(this.program);
			this.program = null;
		}

		if (this.canvas) {
			this.canvas.remove();
			this.canvas = null;
		}

		this.gl = null;

		// Clear container
		this.container.innerHTML = '';
	}
}
