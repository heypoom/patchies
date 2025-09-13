import type Sketch from 'p5';
import { GLSystem } from '$lib/canvas/GLSystem';
import type { UserFnRunContext } from '$lib/messages/MessageContext';
import { JSRunner } from '$lib/js-runner/JSRunner';
import { deleteAfterComment } from '$lib/js-runner/js-module-utils';

interface P5SketchConfig {
	code: string;
	messageContext?: UserFnRunContext;

	setHidePorts?: (hide: boolean) => void;
}

export class P5Manager {
	public p5: Sketch | null = null;
	public glSystem = GLSystem.getInstance();
	public jsRunner = JSRunner.getInstance();
	public nodeId: string;

	public shouldSendBitmap = true;

	private container: HTMLElement | null = null;

	constructor(nodeId: string, container: HTMLElement) {
		this.nodeId = nodeId;
		this.container = container;

		// @ts-expect-error -- expose for debugging
		window[nodeId] = this;
	}

	async updateCode(config: P5SketchConfig) {
		if (this.p5) {
			this.p5.remove();
			this.p5 = null;
		}

		if (!this.container) return;

		const { default: P5 } = await import('p5');

		const delimiter = '// [!!PATCHIES_DELETE!!]';

		// HACK: prevent rollup from tree-shaking unused functions
		const codeWithTemplate = `
			${config.code}

			${delimiter}
			setup(); draw(); preload(); mousePressed(); mouseReleased(); mouseClicked(); mouseMoved(); mouseDragged(); mouseWheel(); doubleClicked(); keyPressed(); keyReleased(); keyTyped(); touchStarted(); touchMoved(); touchEnded(); windowResized(); deviceMoved(); deviceTurned(); deviceShaken();
		`;

		let processedCode = await this.jsRunner.preprocessCode(codeWithTemplate, {
			nodeId: this.nodeId,
			setLibraryName: () => {}
		});

		if (processedCode !== null) {
			processedCode = deleteAfterComment(processedCode, delimiter).trim();
		}

		const sketch = (p: Sketch) => {
			const sketchConfig: P5SketchConfig = {
				...config,
				code: processedCode ?? config.code
			};

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const userCode = this.executeUserCode(p, sketchConfig, P5) as any;

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

	private executeUserCode(sketch: Sketch, config: P5SketchConfig, P5Constructor: unknown) {
		for (const key in sketch) {
			// @ts-expect-error -- no-op
			if (typeof sketch[key] === 'function') {
				// @ts-expect-error -- no-op
				sketch[key] = sketch[key].bind(sketch);
			}
		}

		(sketch as unknown as Record<string, unknown>)['p5'] = P5Constructor;

		// P5.js wrapper code that returns the functions
		const codeWithWrapper = `
			var setup, draw, preload, mousePressed, mouseReleased, mouseClicked, mouseMoved, mouseDragged, mouseWheel, doubleClicked, keyPressed, keyReleased, keyTyped, touchStarted, touchMoved, touchEnded, windowResized, deviceMoved, deviceTurned, deviceShaken;

			with (sketch) {
				${config.code}

				return { setup, draw, preload, mousePressed, mouseReleased, mouseClicked, mouseMoved, mouseDragged, mouseWheel, doubleClicked, keyPressed, keyReleased, keyTyped, touchStarted, touchMoved, touchEnded, windowResized, deviceMoved, deviceTurned, deviceShaken };
			}
		`;

		// Execute using JSRunner with P5-specific extra context
		return this.jsRunner.executeJavaScript(this.nodeId, codeWithWrapper, {
			customConsole: console,
			setPortCount: config.messageContext?.setPortCount,
			setTitle: config.messageContext?.setTitle,
			extraContext: {
				sketch,
				noDrag: config.messageContext?.noDrag,
				setHidePorts: config.setHidePorts
			}
		});
	}

	destroy() {
		if (this.p5) {
			this.p5.remove();
			this.p5 = null;
		}
		this.container = null;

		// Clean up JSRunner resources for this node
		this.jsRunner.destroy(this.nodeId);
	}

	async sendBitmap() {
		// @ts-expect-error -- do not capture if bitmap is missing
		const canvas: HTMLCanvasElement = this.p5?.canvas;
		if (!canvas) return;

		if (!this.shouldSendBitmap) return;
		if (!this.glSystem.hasOutgoingVideoConnections(this.nodeId)) return;

		await this.glSystem.setBitmapSource(this.nodeId, canvas);
	}
}
