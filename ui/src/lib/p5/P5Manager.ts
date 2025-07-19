import p5 from 'p5';
import type p5Type from 'p5';

export interface P5SketchConfig {
	code: string;
	width?: number;
	height?: number;
}

export class P5Manager {
	private instance: p5Type | null = null;
	private container: HTMLElement | null = null;

	constructor(container: HTMLElement) {
		this.container = container;
	}

	createSketch(config: P5SketchConfig) {
		// Clean up existing instance
		if (this.instance) {
			this.instance.remove();
			this.instance = null;
		}

		if (!this.container) return;

		const sketch = (p: p5Type) => {
			let userSetup: (() => void) | undefined;
			let userDraw: (() => void) | undefined;

			try {
				const { setup, draw } = this.executeUserCode(p, config.code);
				userSetup = setup;
				userDraw = draw;
			} catch (error) {
				console.log('P5 code error:', error);
			}

			p.setup = function () {
				p.createCanvas(config.width || 200, config.height || 120);
				if (userSetup) {
					try {
						userSetup.call(p);
					} catch (error) {
						console.log('P5 setup error:', error);
					}
				}
			};

			p.draw = function () {
				if (userDraw) {
					try {
						userDraw.call(p);
					} catch (error) {
						if (error instanceof Error) {
							p.background(220, 100, 100);
							p.fill(255);
							p.text(`error: ${error.message}`, 10, 60);
						}
					}
				}
			};
		};

		this.instance = new p5(sketch, this.container);
	}

	private executeUserCode(p: p5Type, code: string) {
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
			'loadPixels'
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
			'frameCount'
		];

		// Bind common methods
		commonP5Methods.forEach((method) => {
			if (typeof p[method] === 'function') {
				p5Context[method] = p[method].bind(p);
			}
		});

		// Copy common properties and constants
		commonP5Properties.forEach((prop) => {
			if (p[prop] !== undefined) {
				p5Context[prop] = p[prop];
			}
		});

		// Execute user code with 'with' statement for clean access
		const userCode = new Function(
			'p5Context',
			`
			with (p5Context) {
				${code}
				return { setup, draw };
			}
		`
		);

		return userCode(p5Context);
	}

	updateCode(code: string, width?: number, height?: number) {
		this.createSketch({ code, width, height });
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
}
