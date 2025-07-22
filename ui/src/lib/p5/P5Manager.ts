import p5 from 'p5';
import type p5Type from 'p5';

interface SendMessageOptions {
	type?: string;
	to?: string;
}

const width = 800;
const height = 800;

interface MessageContext {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	send: (data: any, options?: SendMessageOptions) => void;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	onMessage: (callback: (message: any) => void) => void;

	interval: (callback: () => void, ms: number) => number;
}

export interface P5SketchConfig {
	code: string;
	width?: number;
	height?: number;
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
			const { setup, draw, mouseClicked } = this.executeUserCode(p, config);

			const userSetup = setup;
			const userDraw = draw;
			const userMouseClicked = mouseClicked;

			p.setup = function () {
				p.createCanvas(config.width || width, config.height || height);

				userSetup?.call(p);
			};

			p.draw = function () {
				try {
					userDraw?.call(p);
				} catch (error) {
					if (error instanceof Error) {
						p.background(220, 100, 100);
						p.fill(255);
					}

					throw error;
				}
			};

			p.mouseClicked = function (event: MouseEvent) {
				userMouseClicked?.call(p, event);
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
			var setup, draw, mouseClicked;

			with (p5Context) {
				// Inject message system functions if available
				if (messageContext) {
					var send = messageContext.send;
					var onMessage = messageContext.onMessage;
					var setInterval = messageContext.interval;
					var recv = receive = onMessage // alias for onMessage
				}
				
				${config.code}
				return { setup, draw, mouseClicked };
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
