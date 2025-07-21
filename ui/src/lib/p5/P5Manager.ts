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
			let userSetup: (() => void) | undefined;
			let userDraw: (() => void) | undefined;
			let userMouseClicked: ((event: MouseEvent) => void) | undefined;

			try {
				const { setup, draw, mouseClicked } = this.executeUserCode(p, config);
				userSetup = setup;
				userDraw = draw;
				userMouseClicked = mouseClicked;
			} catch (error) {
				console.log('P5 code error:', error);
			}

			p.setup = function () {
				p.createCanvas(config.width || 200, config.height || 120);

				try {
					userSetup?.call(p);
				} catch (error) {
					console.log('P5 setup error:', error);
				}
			};

			p.draw = function () {
				try {
					userDraw?.call(p);
				} catch (error) {
					if (error instanceof Error) {
						p.background(220, 100, 100);
						p.fill(255);
						p.text(`error: ${error.message}`, 10, 60);
					}
				}
			};

			p.mouseClicked = function (event: MouseEvent) {
				try {
					userMouseClicked?.call(p, event);
				} catch (error) {
					console.log('P5 mouseClicked error:', error);
				}
			};
		};

		this.instance = new p5(sketch, this.container);
	}

	private executeUserCode(p: p5Type, config: P5SketchConfig) {
		// Create a context object with bound p5 functions
		const p5Context = {};

		// Only expose the most commonly used p5 functions and constants
		const commonP5Methods = [
			'createCanvas',
			'background',
			'fill',
			'stroke',
			'noStroke',
			'strokeWeight',
			'ellipse',
			'rect',
			'circle',
			'line',
			'point',
			'text',
			'triangle',
			'random',
			'noise',
			'map',
			'describe',
			'constrain',
			'lerp',
			'sin',
			'cos',
			'tan',
			'atan2',
			'degrees',
			'radians',
			'push',
			'pop',
			'translate',
			'rotate',
			'scale',
			'beginShape',
			'endShape',
			'vertex',
			'curveVertex',
			'bezierVertex',
			'loadPixels',
			'colorMode',
			'angleMode',
			'min',
			'max',
			'createVideo',
			'image'
		];

		const commonP5Properties = [
			'PI',
			'TWO_PI',
			'HALF_PI',
			'mouseX',
			'mouseY',
			'pmouseX',
			'pmouseY',
			'mouseIsPressed',
			'frameCount',
			'width',
			'height'
		];

		// Bind common methods
		commonP5Methods.forEach((method) => {
			// @ts-expect-error -- no-op
			if (typeof p[method] === 'function') {
				// @ts-expect-error -- no-op
				p5Context[method] = p[method].bind(p);
			}
		});

		// Copy common properties and constants
		commonP5Properties.forEach((prop) => {
			// @ts-expect-error -- no-op
			if (p[prop] !== undefined) {
				// @ts-expect-error -- no-op
				p5Context[prop] = p[prop];
			}
		});

		// Add fromCanvas function for video chaining
		// @ts-expect-error -- no-op
		p5Context['fromCanvas'] = this.createFromCanvasFunction(p);

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
