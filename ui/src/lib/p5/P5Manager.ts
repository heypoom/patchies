import type Sketch from 'p5';
import { GLSystem } from '$lib/canvas/GLSystem';
import type { UserFnRunContext } from '$lib/messages/MessageContext';
import { JSRunner } from '$lib/js-runner/JSRunner';
import { deleteAfterComment } from '$lib/js-runner/js-module-utils';
import type { Viewport } from '@xyflow/svelte';

interface P5SketchConfig {
	code: string;
	messageContext?: UserFnRunContext;

	setHidePorts?: (hide: boolean) => void;

	/**
	 * The P5CanvasNode component is being mounted and the playing state is PAUSED,
	 * so we must noLoop() the sketch on mount.
	 **/
	pauseOnMount?: boolean;

	/**
	 * Custom console for redirecting console.* calls to VirtualConsole.
	 * If not provided, uses the global console.
	 */
	customConsole?: {
		log: (...args: unknown[]) => void;
		error: (...args: unknown[]) => void;
		warn: (...args: unknown[]) => void;
		debug: (...args: unknown[]) => void;
		info: (...args: unknown[]) => void;
	};

	/**
	 * Callback for runtime errors in draw(), setup(), etc.
	 * Used for error line highlighting.
	 */
	onRuntimeError?: (error: Error) => void;
}

export class P5Manager {
	public p5: Sketch | null = null;
	public glSystem = GLSystem.getInstance();
	public jsRunner = JSRunner.getInstance();
	public nodeId: string;

	public shouldSendBitmap = true;

	private container: HTMLElement | null = null;
	private viewport: { current: Viewport } | null = null;

	private static compatLibsLoaded = false;

	constructor(nodeId: string, container: HTMLElement, viewport?: { current: Viewport }) {
		this.nodeId = nodeId;
		this.container = container;
		this.viewport = viewport || null;

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

		// Load P5.js v2 compatibility libraries (only once)
		if (!P5Manager.compatLibsLoaded) {
			await this.loadCompatibilityLibraries(P5);
			P5Manager.compatLibsLoaded = true;
		}

		const delimiter = '// [!!PATCHIES_DELETE!!]';

		// HACK: prevent rollup from tree-shaking unused functions.
		// We'll delete everything after the delimiter, so these functions will not actually be called at runtime.
		// It's just to trick and bamboozle rollup into thinking that these functions are used.
		const codeWithTemplate = `
			${config.code}

			${delimiter}

			setup(); draw(); preload(); mousePressed(); mouseReleased(); mouseClicked(); mouseMoved(); mouseDragged();
			mouseWheel(); doubleClicked(); keyPressed(); keyReleased(); keyTyped(); touchStarted(); touchMoved();
			touchEnded(); windowResized(); deviceMoved(); deviceTurned(); deviceShaken();
		`;

		let processedCode = await this.jsRunner.preprocessCode(codeWithTemplate, {
			nodeId: this.nodeId,
			setLibraryName: () => {}
		});

		if (processedCode !== null) {
			processedCode = deleteAfterComment(processedCode, delimiter).trim();
		}

		const sketch = async (p: Sketch) => {
			const onRuntimeError = config.onRuntimeError;

			try {
				const sketchConfig: P5SketchConfig = {
					...config,
					code: processedCode ?? config.code
				};

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				let userCode: any;
				try {
					userCode = await this.executeUserCode(p, sketchConfig, P5);
				} catch (error) {
					// Catch syntax errors during code compilation
					if (error instanceof Error) {
						onRuntimeError?.(error);
					}
					return;
				}

				try {
					await userCode?.preload?.call(p);
					await userCode?.setup?.call(p);
				} catch (error) {
					if (error instanceof Error) {
						onRuntimeError?.(error);
					}
					return;
				}

				const sendBitmap = this.sendBitmap.bind(this);

				p.setup = function () {
					try {
						userCode?.setup?.call(p);
					} catch (error) {
						if (error instanceof Error) {
							onRuntimeError?.(error);
						}
					}
				};

				p.draw = function () {
					try {
						userCode?.draw?.call(p);
						sendBitmap();
					} catch (error) {
						if (error instanceof Error) {
							p.background(220, 100, 100);
							p.fill(255);
							onRuntimeError?.(error);
						}
						// Stop the loop to prevent error spam
						p.noLoop();
					}
				};

				// @ts-expect-error -- compatibility layer for P5.js version 1
				p.preload = function () {
					userCode?.preload?.call(p);
				};

				// Helper to adjust mouse coordinates for zoom
				const adjustMouseForZoom = () => {
					if (this.viewport) {
						const zoom = this.viewport.current.zoom;
						// Store original values
						const originalMouseX = p.mouseX;
						const originalMouseY = p.mouseY;
						const originalPmouseX = p.pmouseX;
						const originalPmouseY = p.pmouseY;

						// !! Adjust for zoom
						// @ts-expect-error -- we are hacking the p5 instance here
						p.mouseX = originalMouseX / zoom;

						// @ts-expect-error -- we are hacking the p5 instance here
						p.mouseY = originalMouseY / zoom;

						// @ts-expect-error -- we are hacking the p5 instance here
						p.pmouseX = originalPmouseX / zoom;

						// @ts-expect-error -- we are hacking the p5 instance here
						p.pmouseY = originalPmouseY / zoom;
					}
				};

				p.mousePressed = function (event: MouseEvent) {
					adjustMouseForZoom();
					userCode?.mousePressed?.call(p, event);
				};

				p.mouseReleased = function (event: MouseEvent) {
					adjustMouseForZoom();
					userCode?.mouseReleased?.call(p, event);
				};

				p.mouseClicked = function (event: MouseEvent) {
					adjustMouseForZoom();
					userCode?.mouseClicked?.call(p, event);
				};

				p.mouseMoved = function (event: MouseEvent) {
					adjustMouseForZoom();
					userCode?.mouseMoved?.call(p, event);
				};

				p.mouseDragged = function (event: MouseEvent) {
					adjustMouseForZoom();
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

				// @ts-expect-error -- not typed
				p.touchStarted = function (event: TouchEvent) {
					userCode?.touchStarted?.call(p, event);
				};

				// @ts-expect-error -- not typed
				p.touchMoved = function (event: TouchEvent) {
					userCode?.touchMoved?.call(p, event);
				};

				// @ts-expect-error -- not typed
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
			} catch (error) {
				// Catch any P5.js internal errors (e.g., renderer not ready)
				if (error instanceof Error) {
					onRuntimeError?.(error);
				}
			}
		};

		this.p5 = new P5(sketch, this.container);

		// The component are being mounted and the playing state is PAUSED,
		// so we must noLoop() the sketch on mount.
		if (config.pauseOnMount) {
			this.p5.noLoop();
		}
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
			customConsole: config.customConsole ?? console,
			setPortCount: config.messageContext?.setPortCount,
			setTitle: config.messageContext?.setTitle,
			extraContext: {
				sketch,
				noDrag: config.messageContext?.noDrag,
				noOutput: config.messageContext?.noOutput,
				setHidePorts: config.setHidePorts
			}
		});
	}

	private async loadCompatibilityLibraries(P5: any) {
		// Load P5.js v1 compatibility add-ons for P5.js v2
		// These preserve v1 APIs: preload(), bezierVertex(), curveVertex(), data structures, etc.
		const compatLibs = [
			{ path: '/lib/p5/compat/preload.js', fn: 'addPreloadCompat' },
			{ path: '/lib/p5/compat/shapes.js', fn: 'addShapesCompat' },
			{ path: '/lib/p5/compat/data.js', fn: 'addDataCompat' }
		];

		for (const lib of compatLibs) {
			// Load the script
			await new Promise<void>((resolve, reject) => {
				const script = document.createElement('script');
				script.src = lib.path;
				script.onload = () => resolve();
				script.onerror = () => reject(new Error(`Failed to load ${lib.path}`));
				document.head.appendChild(script);
			});

			// Call the compatibility function with P5 constructor
			const compatFn = (window as any)[lib.fn];
			if (compatFn) {
				compatFn(P5);
				// Clean up the global function
				delete (window as any)[lib.fn];
			}
		}
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
