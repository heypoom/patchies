import P5 from 'p5';
import type Sketch from 'p5';
import ml5 from 'ml5';
import { GLSystem } from '$lib/canvas/GLSystem';

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
	public p5: Sketch | null = null;
	public glSystem = GLSystem.getInstance();
	public nodeId: string;

	private container: HTMLElement | null = null;

	constructor(nodeId: string, container: HTMLElement) {
		this.nodeId = nodeId;
		this.container = container;

		// @ts-expect-error -- expose for debugging
		window.p5Manager = this;
	}

	updateCode(config: P5SketchConfig) {
		// Clean up existing instance
		if (this.p5) {
			this.p5.remove();
			this.p5 = null;
		}

		if (!this.container) return;

		const sketch = (p: Sketch) => {
			const userCode = this.executeUserCode(p, config);
			const sendBitmap = this.sendBitmap.bind(this);

			p.setup = function () {
				userCode?.setup?.call(p);
			};

			p.draw = function () {
				try {
					userCode?.draw?.call(p);
					sendBitmap();
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

		this.p5 = new P5(sketch, this.container);
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
		sketch['p5'] = P5;

		// @ts-expect-error -- no-op
		window.ml5 = ml5;

		// @ts-expect-error -- no-op
		sketch['ml5'] = ml5;

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
					var recv = receive = listen = onMessage; // alias for onMessage
				}
				
				${config.code}

				return { setup, draw, preload, mousePressed, mouseReleased, mouseClicked, mouseMoved, mouseDragged, mouseWheel, doubleClicked, keyPressed, keyReleased, keyTyped, touchStarted, touchMoved, touchEnded, windowResized, deviceMoved, deviceTurned, deviceShaken };
			}
		`
		);

		return userCode(sketch, config.messageContext ?? {});
	}

	destroy() {
		if (this.p5) {
			this.p5.remove();
			this.p5 = null;
		}
		this.container = null;
	}

	async sendBitmap() {
		// @ts-expect-error -- do not capture if bitmap is missing
		const canvas: HTMLCanvasElement = this.p5?.canvas;
		if (!canvas) return;

		await this.glSystem.setBitmapSource(this.nodeId, canvas);
	}
}
