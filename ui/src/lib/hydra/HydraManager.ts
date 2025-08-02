import { Hydra, generators } from 'hydra-ts';
import REGL from 'regl';

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
}

export interface HydraConfig {
	code: string;
	messageContext?: MessageContext;
}

const [previewWidth, previewHeight] = [200, 200];
const [canvasWidth, canvasHeight] = [400 * window.devicePixelRatio, 400 * window.devicePixelRatio];

export class HydraManager {
	private hydra: Hydra;
	private canvas: HTMLCanvasElement | null = null;
	private container: HTMLElement;
	private videoCanvases: HTMLCanvasElement[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private activeSources: any[] = [];
	private regl: REGL.Regl;

	constructor(container: HTMLElement, config: HydraConfig | string) {
		this.container = container;

		// Create canvas element
		this.canvas = document.createElement('canvas');
		this.canvas.width = canvasWidth;
		this.canvas.height = canvasHeight;
		this.canvas.style.width = previewWidth + 'px';
		this.canvas.style.height = previewHeight + 'px';
		this.canvas.style.objectFit = 'contain';

		// Clear container and add canvas
		this.container.innerHTML = '';
		this.container.appendChild(this.canvas);

		// TODO: move this inside the web worker!
		this.regl = REGL({ canvas: this.canvas });

		// Initialize Hydra in non-global mode
		this.hydra = new Hydra({
			// @ts-expect-error -- not sure why type is not matching here.
			regl: this.regl,
			width: canvasWidth,
			height: canvasHeight,
			numSources: 4,
			numOutputs: 4,
			precision: 'highp'
		});

		// @ts-expect-error -- used for global access in devtools
		window.hydra = this.hydra;

		try {
			// Execute the user code
			const codeString = typeof config === 'string' ? config : config.code;
			const messageContext = typeof config === 'string' ? undefined : config.messageContext;

			this.executeCode(codeString, messageContext);
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

	updateCode(config: HydraConfig | string) {
		if (this.synth) {
			try {
				const codeString = typeof config === 'string' ? config : config.code;
				const messageContext = typeof config === 'string' ? undefined : config.messageContext;
				this.executeCode(codeString, messageContext);
			} catch (error) {
				console.error('Error updating Hydra code:', error);
			}
		}
	}

	private executeCode(code: string, messageContext?: MessageContext) {
		try {
			const { src, osc, gradient, shape, voronoi, noise, solid } = generators;
			const { sources, outputs, hush, loop, render } = this.hydra;

			const [s0, s1, s2, s3] = sources;
			const [o0, o1, o2, o3] = outputs;

			// Clear any existing patterns
			if (this.synth) {
				// Stop all sources
				for (const source of sources) source.clear();

				hush();
			}

			// Create a context with Hydra synth instance available as 'h'
			// Also destructure common functions for easier access
			const context = {
				h: this.synth,
				loop,

				// Destructure common functions for convenience
				osc,
				gradient,
				shape,
				voronoi,
				noise,
				src,
				solid,

				// Sources
				s0,
				s1,
				s2,
				s3,

				// Outputs
				o0,
				o1,
				o2,
				o3,

				// Render function
				render: render.bind(this.hydra),

				// Video chaining function
				initSource: this.createInitSourceFunction(),

				// Message system functions (if available)
				...(messageContext && {
					send: messageContext.send,
					onMessage: messageContext.onMessage,
					interval: messageContext.interval
				})
			};

			// Execute the user's Hydra code with the synth context
			const executeFunction = new Function(
				'context',
				`
				let time = performance.now()

				with (context) {
					${code}

					loop.start()
				}
			`
			);

			executeFunction(context);
		} catch (error) {
			console.error('Error executing Hydra code:', error);
			throw error;
		}
	}

	destroy() {
		if (this.hydra) {
			// Clean up Hydra synth instance
			try {
				this.hydra.hush();
			} catch (error) {
				console.warn('Error stopping Hydra synth:', this.synth, error);
			}
		}

		// Clear active sources
		this.activeSources = [];

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
		this.videoCanvases = canvases.slice(0, 4); // Only take first 4 canvases

		// Reinitialize active sources with the new canvases
		for (const source of this.activeSources) {
			if (source && this.videoCanvases.length > 0) {
				// Use the first canvas as the primary source for backward compatibility
				source.init({ src: this.videoCanvases[0] });
			}
		}
	}

	private createInitSourceFunction() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return (source?: any, inletIndex: number = 0) => {
			if (this.videoCanvases.length === 0 || inletIndex >= this.videoCanvases.length) {
				return null;
			}

			const targetCanvas = this.videoCanvases?.[inletIndex];

			// Initialize hydra's source with the canvas element
			if (source && targetCanvas) {
				source.init({ src: targetCanvas });

				// Track this source so we can reinitialize it when canvas changes
				if (!this.activeSources.includes(source)) {
					this.activeSources.push(source);
				}
			}

			return targetCanvas;
		};
	}
}
