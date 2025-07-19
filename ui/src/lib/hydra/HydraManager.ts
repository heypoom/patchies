// @ts-expect-error -- no types for hydra-synth
import Hydra from 'hydra-synth';

export class HydraManager {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private hydra: any;
	private canvas: HTMLCanvasElement | null = null;
	private container: HTMLElement;

	constructor(container: HTMLElement, code: string) {
		this.container = container;

		// Create canvas element
		this.canvas = document.createElement('canvas');
		this.canvas.width = 200;
		this.canvas.height = 200;
		this.canvas.style.width = '100%';
		this.canvas.style.height = '100%';
		this.canvas.style.objectFit = 'contain';

		// Clear container and add canvas
		this.container.innerHTML = '';
		this.container.appendChild(this.canvas);

		// Initialize Hydra in non-global mode
		this.hydra = new Hydra({
			canvas: this.canvas,
			width: 200,
			height: 200,
			autoLoop: true,
			makeGlobal: false,
			detectAudio: false,
			numSources: 4,
			numOutputs: 4,
			precision: 'mediump'
		});

		try {
			// Execute the user code
			this.executeCode(code);
		} catch (error) {
			console.error('Error creating Hydra sketch:', error);

			if (error instanceof Error) {
				this.container.innerHTML = `<div class="text-red-400 text-xs p-2">Error: ${error.message}</div>`;
			}
		}
	}

	get synth() {
		return this.hydra.synth;
	}

	updateCode(code: string) {
		if (this.synth) {
			try {
				this.executeCode(code);
			} catch (error) {
				console.error('Error updating Hydra code:', error);
			}
		}
	}

	private executeCode(code: string) {
		try {
			// Clear any existing patterns
			if (this.synth) {
				// Stop all sources
				for (let i = 0; i < 4; i++) {
					this.synth.s?.[i].clear();
				}
				// Clear all outputs
				for (let i = 0; i < 4; i++) {
					this.synth.o?.[i].clear();
				}
			}

			// Create a context with Hydra synth instance available as 'h'
			// Also destructure common functions for easier access
			const context = {
				h: this.synth,

				// Destructure common functions for convenience
				osc: this.synth.osc.bind(this.synth),
				gradient: this.synth.gradient.bind(this.synth),
				shape: this.synth.shape.bind(this.synth),
				voronoi: this.synth.voronoi.bind(this.synth),
				noise: this.synth.noise.bind(this.synth),
				src: this.synth.src.bind(this.synth),
				solid: this.synth.solid.bind(this.synth),
				// Sources
				s0: this.synth.s0,
				s1: this.synth.s1,
				s2: this.synth.s2,
				s3: this.synth.s3,
				// Outputs
				o0: this.synth.o0,
				o1: this.synth.o1,
				o2: this.synth.o2,
				o3: this.synth.o3,
				// Render function
				render: this.synth.render.bind(this.synth)
			};

			// Execute the user's Hydra code with the synth context
			const functionParams = Object.keys(context);
			const functionArgs = Object.values(context);
			const executeFunction = new Function(
				...functionParams,
				`

				${code}
			`
			);
			executeFunction(...functionArgs);
		} catch (error) {
			console.error('Error executing Hydra code:', error);
			throw error;
		}
	}

	destroy() {
		if (this.synth) {
			// Clean up Hydra synth instance
			try {
				this.synth.stop();
			} catch (error) {
				console.warn('Error stopping Hydra synth:', error);
			}

			this.hydra.synth = null;
		}

		if (this.hydra) {
			this.hydra = null;
		}

		if (this.canvas) {
			this.canvas.remove();
			this.canvas = null;
		}

		// Clear container
		this.container.innerHTML = '';
	}
}
