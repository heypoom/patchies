import P5 from 'p5';
import type Sketch from 'p5';

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

		// @ts-expect-error -- no-op
		sketch['getSource'] = this.createGetSourceFunction(sketch);

		// @ts-expect-error -- no-op
		sketch['p5'] = P5;

		// Add function for copying from video canvas
		// @ts-expect-error -- no-op
		sketch['drawSource'] = () => {
			const source = this.videoCanvas;
			if (!source) return;

			// @ts-expect-error -- no-op
			const { canvas } = sketch;
			if (!canvas) return;

			canvas
				.getContext('2d')
				?.drawImage(
					source,
					0,
					0,
					source.width,
					source.height,
					0,
					0,
					canvas.width / window.devicePixelRatio,
					canvas.height / window.devicePixelRatio
				);
		};

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

	private createGetSourceFunction() {
		return () => {
			return this.videoCanvas ?? null;
		};
	}
}
