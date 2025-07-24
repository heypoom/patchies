import P5 from 'p5';
import type Sketch from 'p5';

import type { AudioAnalysis } from '$lib/audio/AudioSystem';

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

	/** Disables dragging in canvas. */
	noDrag: () => void;
}

export interface P5SketchConfig {
	code: string;
	messageContext?: MessageContext;
}

export class P5Manager {
	private instance: Sketch | null = null;
	private container: HTMLElement | null = null;
	private videoCanvas: HTMLCanvasElement | null = null;
	private audioAnalysis: AudioAnalysis | null = null;

	constructor(container: HTMLElement) {
		this.container = container;
	}

	updateCode(config: P5SketchConfig) {
		// Clean up existing instance
		if (this.instance) {
			this.instance.remove();
			this.instance = null;
		}

		if (!this.container) return;

		const sketch = (p: Sketch) => {
			const userCode = this.executeUserCode(p, config);

			p.setup = function () {
				userCode?.setup?.call(p);
			};

			p.draw = function () {
				try {
					userCode?.draw?.call(p);
				} catch (error) {
					if (error instanceof Error) {
						p.background(220, 100, 100);
						p.fill(255);
					}

					throw error;
				}
			};

			p.preload = function () {
				userCode?.preload?.call(p);
			};

			p.mousePressed = function (event: MouseEvent) {
				userCode?.mousePressed?.call(p, event);
			};

			p.mouseReleased = function (event: MouseEvent) {
				userCode?.mouseReleased?.call(p, event);
			};

			p.mouseClicked = function (event: MouseEvent) {
				userCode?.mouseClicked?.call(p, event);
			};

			p.mouseMoved = function (event: MouseEvent) {
				userCode?.mouseMoved?.call(p, event);
			};

			p.mouseDragged = function (event: MouseEvent) {
				userCode?.mouseDragged?.call(p, event);
			};

			p.mouseWheel = function (event: WheelEvent) {
				userCode?.mouseWheel?.call(p, event);
			};

			p.doubleClicked = function (event: MouseEvent) {
				userCode?.doubleClicked?.call(p, event);
			};

			p.keyPressed = function (event: KeyboardEvent) {
				userCode?.keyPressed?.call(p, event);
			};

			p.keyReleased = function (event: KeyboardEvent) {
				userCode?.keyReleased?.call(p, event);
			};

			p.keyTyped = function (event: KeyboardEvent) {
				userCode?.keyTyped?.call(p, event);
			};

			p.touchStarted = function (event: TouchEvent) {
				userCode?.touchStarted?.call(p, event);
			};

			p.touchMoved = function (event: TouchEvent) {
				userCode?.touchMoved?.call(p, event);
			};

			p.touchEnded = function (event: TouchEvent) {
				userCode?.touchEnded?.call(p, event);
			};

			p.windowResized = function () {
				userCode?.windowResized?.call(p);
			};

			p.deviceMoved = function () {
				userCode?.deviceMoved?.call(p);
			};

			p.deviceTurned = function () {
				userCode?.deviceTurned?.call(p);
			};

			p.deviceShaken = function () {
				userCode?.deviceShaken?.call(p);
			};
		};

		this.instance = new P5(sketch, this.container);
	}

	private executeUserCode(sketch: Sketch, config: P5SketchConfig) {
		for (const key in sketch) {
			// @ts-expect-error -- no-op
			if (typeof sketch[key] === 'function') {
				// @ts-expect-error -- no-op
				sketch[key] = sketch[key].bind(sketch);
			}
		}

		// Add fromCanvas function for video chaining
		// @ts-expect-error -- no-op
		sketch['fromCanvas'] = this.createFromCanvasFunction(sketch);

		// @ts-expect-error -- no-op
		sketch['p5'] = P5;

		// Add audio analysis data (always available, even if null)
		// @ts-expect-error -- no-op
		sketch['audio'] = this.createAudioContext();

		// Execute user code with 'with' statement for clean access
		const userCode = new Function(
			'sketch',
			'sketchContext',
			`
			var setup, draw, preload, mousePressed, mouseReleased, mouseClicked, mouseMoved, mouseDragged, mouseWheel, doubleClicked, keyPressed, keyReleased, keyTyped, touchStarted, touchMoved, touchEnded, windowResized, deviceMoved, deviceTurned, deviceShaken;

			with (sketch) {
				// Inject message system functions if available
				if (sketchContext) {
					var send = sketchContext.send;
					var onMessage = sketchContext.onMessage;
					var setInterval = sketchContext.interval;
					var noDrag = sketchContext.noDrag;

					var recv = receive = onMessage; // alias for onMessage
				}
				
				${config.code}

				return { setup, draw, preload, mousePressed, mouseReleased, mouseClicked, mouseMoved, mouseDragged, mouseWheel, doubleClicked, keyPressed, keyReleased, keyTyped, touchStarted, touchMoved, touchEnded, windowResized, deviceMoved, deviceTurned, deviceShaken };
			}
		`
		);

		return userCode(sketch, config.messageContext ?? {});
	}

	destroy() {
		if (this.instance) {
			this.instance.remove();
			this.instance = null;
		}
		this.container = null;
	}

	getInstance() {
		return this.instance;
	}

	getCanvas(): HTMLCanvasElement | null {
		const instance = this.instance as unknown as { canvas?: HTMLCanvasElement };

		return instance?.canvas ?? null;
	}

	setVideoCanvas(canvas: HTMLCanvasElement | null) {
		this.videoCanvas = canvas;
	}

	setAudioAnalysis(analysis: AudioAnalysis | null) {
		this.audioAnalysis = analysis;
	}

	private createFromCanvasFunction() {
		return () => {
			return this.videoCanvas ?? null;
		};
	}

	private createAudioContext() {
		return {
			// Overall loudness (0-1)
			rms: this.audioAnalysis?.rms ?? 0,

			// Brightness measure (higher = more treble/bright)
			spectralCentroid: this.audioAnalysis?.spectralCentroid ?? 0,

			// Zero crossing rate (higher = more noisy/percussive)
			zcr: this.audioAnalysis?.zcr ?? 0,

			// FFT frequency data
			spectrum: this.audioAnalysis?.spectrum ?? new Float32Array(512),

			// Audio context timestamp
			timestamp: this.audioAnalysis?.timestamp ?? 0,

			// Convenience methods for common use cases
			frequency: (index: number) => this.audioAnalysis?.spectrum?.[index] ?? 0,

			bass: () => {
				if (!this.audioAnalysis?.spectrum) return 0;

				// Average the first 4 frequency bins (roughly bass frequencies)
				let sum = 0;
				for (let i = 0; i < 4 && i < this.audioAnalysis.spectrum.length; i++) {
					sum += Math.abs(this.audioAnalysis.spectrum[i]);
				}
				return sum / 4;
			},

			treble: () => {
				if (!this.audioAnalysis?.spectrum) return 0;

				// Average the last quarter of frequency bins (roughly treble frequencies)
				const start = Math.floor(this.audioAnalysis.spectrum.length * 0.75);
				let sum = 0;
				let count = 0;

				for (let i = start; i < this.audioAnalysis.spectrum.length; i++) {
					sum += Math.abs(this.audioAnalysis.spectrum[i]);
					count++;
				}

				return count > 0 ? sum / count : 0;
			},

			loudness: () => this.audioAnalysis?.rms || 0
		};
	}
}
