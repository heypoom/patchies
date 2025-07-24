import p5 from 'p5';
import type p5Type from 'p5';

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
	private instance: p5Type | null = null;
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

		const sketch = (p: p5Type) => {
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

		this.instance = new p5(sketch, this.container);
	}

	private executeUserCode(p: p5Type, config: P5SketchConfig) {
		const p5Context = {};

		for (const key in p) {
			// @ts-expect-error -- no-op
			if (typeof p[key] === 'function') {
				// @ts-expect-error -- no-op
				p5Context[key] = p[key].bind(p);
			} else {
				// @ts-expect-error -- no-op
				p5Context[key] = p[key];
			}
		}

		// Add fromCanvas function for video chaining
		// @ts-expect-error -- no-op
		p5Context['fromCanvas'] = this.createFromCanvasFunction(p);

		// @ts-expect-error -- no-op
		p5Context['sketch'] = p;

		// @ts-expect-error -- no-op
		p5Context['p5'] = p5;

		// Execute user code with 'with' statement for clean access
		const userCode = new Function(
			'p5Context',
			'messageContext',
			`
			var setup, draw, preload, mousePressed, mouseReleased, mouseClicked, mouseMoved, mouseDragged, mouseWheel, doubleClicked, keyPressed, keyReleased, keyTyped, touchStarted, touchMoved, touchEnded, windowResized, deviceMoved, deviceTurned, deviceShaken;

			var _createCanvas = p5Context.createCanvas;

			with (p5Context) {
				// Hack: auto set width and height
				var createCanvas = (...args) => {
					if (typeof args[0] !== undefined) {
						width = args[0]
					}

					if (typeof args[1] !== undefined) {
						height = args[1]
					}

					return _createCanvas(...args);
				}

				// Inject message system functions if available
				if (messageContext) {
					var send = messageContext.send;
					var onMessage = messageContext.onMessage;
					var setInterval = messageContext.interval;
					var recv = receive = onMessage; // alias for onMessage
					var noDrag = messageContext.noDrag;
				}
				
				${config.code}

				return { setup, draw, preload, mousePressed, mouseReleased, mouseClicked, mouseMoved, mouseDragged, mouseWheel, doubleClicked, keyPressed, keyReleased, keyTyped, touchStarted, touchMoved, touchEnded, windowResized, deviceMoved, deviceTurned, deviceShaken };
			}
		`
		);

		return userCode(p5Context, config.messageContext ?? {});
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

	private createFromCanvasFunction(p: p5Type) {
		return () => {
			if (this.videoCanvas) {
				// For p5.js, we can use the canvas directly with createGraphics
				// or draw it using image() function
				return this.videoCanvas;
			}
			return null;
		};
	}
}
