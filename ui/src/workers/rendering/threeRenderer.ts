import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import type { Message, MessageCallbackFn } from '$lib/messages/MessageSystem';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { FFTAnalysis } from '$lib/audio/FFTAnalysis';
import { parseJSError, countLines } from '$lib/js-runner/js-error-parser';
import { getFramebuffer } from './utils';

const THREE_WRAPPER_OFFSET = 6;

type AudioAnalysisType = 'wave' | 'freq';
type AudioAnalysisFormat = 'int' | 'float';

type AudioAnalysisProps = {
	id?: string;
	type?: AudioAnalysisType;
	format?: AudioAnalysisFormat;
};

export interface ThreeConfig {
	code: string;
	nodeId: string;
}

export class ThreeRenderer {
	public config: ThreeConfig;
	public renderer: FBORenderer;

	public framebuffer: regl.Framebuffer2D | null = null;

	public onMessage: MessageCallbackFn = () => {};

	private sampleRate: number = 44000;
	private animationId: number | null = null;

	// FFT state tracking
	public isFFTEnabled = false;
	private fftRequestCache = new Map<string, boolean>();
	private fftDataCache = new Map<string, { data: Uint8Array | Float32Array; timestamp: number }>();

	// Three.js instances
	private THREE: typeof import('three') | null = null;
	private threeWebGLRenderer: import('three').WebGLRenderer | null = null;
	private renderTarget: import('three').WebGLRenderTarget | null = null;

	// User-defined render function
	private userRenderFunc: ((time: number) => void) | null = null;

	// Mouse state (updated each frame from RenderParams)
	private mouseX = 0;
	private mouseY = 0;

	private constructor(config: ThreeConfig, framebuffer: regl.Framebuffer2D, renderer: FBORenderer) {
		this.config = config;
		this.framebuffer = framebuffer;
		this.renderer = renderer;
	}

	static async create(
		config: ThreeConfig,
		framebuffer: regl.Framebuffer2D,
		renderer: FBORenderer
	): Promise<ThreeRenderer> {
		const instance = new ThreeRenderer(config, framebuffer, renderer);
		instance.THREE = await import('three');

		const [width, height] = instance.renderer.outputSize;

		try {
			// const _oc = new OffscreenCanvas(1, 1);

			const fakeCanvas = {
				addEventListener: () => {}
			};

			instance.threeWebGLRenderer = new instance.THREE.WebGLRenderer({
				// @ts-expect-error -- hack: use fake canvas
				canvas: fakeCanvas,
				context: renderer.gl!,
				antialias: true
			});

			instance.threeWebGLRenderer.setSize(width, height, false);

			// Create render target that we'll bind to regl's framebuffer
			instance.renderTarget = new instance.THREE.WebGLRenderTarget(width, height, {
				format: instance.THREE.RGBAFormat,
				type: instance.THREE.UnsignedByteType
			});

			// Bind our regl framebuffer to the render target
			const webglFramebuffer = getFramebuffer(framebuffer);

			if (webglFramebuffer) {
				const props = instance.threeWebGLRenderer.properties.get(instance.renderTarget);
				// console.log('props', props);

				// @ts-expect-error -- hack: access WebGLFramebuffer directly
				props.__webglFramebuffer = webglFramebuffer;
			}
		} catch (error) {
			console.error('error creating THREE', error);
		}

		await instance.updateCode();

		return instance;
	}

	renderFrame(params: RenderParams) {
		if (!this.threeWebGLRenderer || !this.renderTarget || !this.userRenderFunc) return;

		const gl = this.renderer.gl;
		if (!gl) return;

		// Update mouse state from render params
		this.mouseX = params.mouseX;
		this.mouseY = params.mouseY;

		// Set render target to our framebuffer-bound target
		this.threeWebGLRenderer.setRenderTarget(this.renderTarget);

		try {
			// Call user's render function with current time
			this.userRenderFunc(params.lastTime);
		} catch (error) {
			this.handleRuntimeError(error);
		}

		// Reset Three.js internal WebGL state tracking
		// This is critical when sharing context with regl
		// https://threejs.org/docs/#WebGLRenderer.resetState
		// > Can be used to reset the internal WebGL state.
		// > This method is mostly relevant for applications which share
		// > a single WebGL context across multiple WebGL libraries.

		this.threeWebGLRenderer.resetState();
	}

	public async updateCode() {
		if (!this.THREE || !this.threeWebGLRenderer || !this.renderTarget) return;

		this.isFFTEnabled = false;
		this.fftDataCache.clear();
		this.fftRequestCache.clear();

		// Reset drag and video output state
		this.setDragEnabled(true);
		this.setVideoOutputEnabled(true);

		// Cancel any existing animation frame
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}

		try {
			const [width, height] = this.renderer.outputSize;
			const THREE = this.THREE;
			const renderer = this.threeWebGLRenderer;
			const renderTarget = this.renderTarget;

			// Create context with Three.js and utilities
			const context = {
				THREE,
				renderer,
				renderTarget,
				width,
				height,

				// Mouse object with getters for real-time values
				mouse: this.createMouseObject(),

				// FFT function for audio analysis
				fft: this.createFFTFunction(),

				// Message passing
				onMessage: (callback: MessageCallbackFn) => {
					this.onMessage = callback;
				},

				send: this.sendMessage.bind(this),

				// Port and UI control
				setPortCount: (inletCount?: number, outletCount?: number) => {
					this.setPortCount(inletCount, outletCount);
				},

				setTitle: this.setTitle.bind(this),

				noDrag: () => {
					this.setDragEnabled(false);
				},

				noOutput: () => {
					this.setVideoOutputEnabled(false);
				},

				// Custom console
				console: this.createCustomConsole(),

				requestAnimationFrame: () => {}
			};

			// Preprocess code for module support
			const processedCode = await this.renderer.jsRunner.preprocessCode(this.config.code, {
				nodeId: this.config.nodeId,
				setLibraryName: () => {}
			});

			if (processedCode === null) return;

			// Parse user's code to extract the render function
			const funcBody = `
				with (context) {
					var recv = onMessage; // alias for onMessage

					${processedCode}
				}

				return typeof draw === 'function' ? draw : null;
			`;

			const userFunction = new Function('context', funcBody);
			this.userRenderFunc = userFunction(context);

			if (!this.userRenderFunc) {
				this.createCustomConsole().warn(
					'No draw() function found. Define a draw(time) function to render.'
				);
			}
		} catch (error) {
			this.handleCodeError(error);
		}
	}

	destroy() {
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}

		// Dispose Three.js resources
		this.renderTarget?.dispose();
		// Note: We don't dispose the renderer since it shares context with regl

		// Clean up JSRunner context for this node
		this.renderer.jsRunner.destroy(this.config.nodeId);

		this.threeWebGLRenderer = null;
		this.renderTarget = null;
		this.userRenderFunc = null;
	}

	sendMessage(data: unknown, options: SendMessageOptions) {
		self.postMessage({
			type: 'sendMessageFromNode',
			fromNodeId: this.config.nodeId,
			data,
			options
		});
	}

	createFFTFunction() {
		return (options: AudioAnalysisProps = {}) => {
			const { type = 'wave', format = 'int' } = options;
			const { nodeId } = this.config;

			const cacheKey = `${type}-${format}`;

			if (!this.isFFTEnabled) {
				self.postMessage({ type: 'fftEnabled', nodeId, enabled: true });
				this.isFFTEnabled = true;
			}

			if (!this.fftRequestCache.has(cacheKey)) {
				self.postMessage({
					type: 'registerFFTRequest',
					nodeId,
					analysisType: type,
					format
				});

				this.fftRequestCache.set(cacheKey, true);
			}

			const cached = this.fftDataCache.get(cacheKey);
			const bins = cached?.data ?? null;

			return new FFTAnalysis(bins, format, this.sampleRate);
		};
	}

	createMouseObject() {
		const getX = () => this.mouseX;
		const getY = () => this.mouseY;

		return {
			get x() {
				return getX();
			},

			get y() {
				return getY();
			}
		};
	}

	// Method to receive FFT data from main thread
	setFFTData(payload: AudioAnalysisPayloadWithType) {
		const { analysisType, format, array, sampleRate } = payload;

		const cacheKey = `${analysisType}-${format}`;
		this.sampleRate = sampleRate;

		this.fftDataCache.set(cacheKey, {
			data: array,
			timestamp: performance.now()
		});
	}

	setPortCount(inletCount = 1, outletCount = 0) {
		self.postMessage({
			type: 'setPortCount',
			portType: 'message',
			nodeId: this.config.nodeId,
			inletCount,
			outletCount
		});
	}

	setTitle(title: string) {
		self.postMessage({
			type: 'setTitle',
			nodeId: this.config.nodeId,
			title
		});
	}

	setDragEnabled(dragEnabled: boolean) {
		self.postMessage({
			type: 'setDragEnabled',
			nodeId: this.config.nodeId,
			dragEnabled
		});
	}

	setVideoOutputEnabled(videoOutputEnabled: boolean) {
		self.postMessage({
			type: 'setVideoOutputEnabled',
			nodeId: this.config.nodeId,
			videoOutputEnabled
		});
	}

	handleMessage(message: Message) {
		this.onMessage?.(message.data, message);
	}

	/**
	 * Handles runtime errors during rendering (throttled to avoid flooding at high fps)
	 */
	private lastRuntimeError: string | null = null;
	private lastRuntimeErrorTime = 0;
	private static readonly RUNTIME_ERROR_THROTTLE_MS = 1000;

	handleRuntimeError(error: unknown): void {
		const { nodeId, code } = this.config;
		const errorMessage = error instanceof Error ? error.message : String(error);

		const now = performance.now();

		// Throttle: skip if same error was reported recently
		if (
			this.lastRuntimeError === errorMessage &&
			now - this.lastRuntimeErrorTime < ThreeRenderer.RUNTIME_ERROR_THROTTLE_MS
		) {
			return;
		}

		this.lastRuntimeError = errorMessage;
		this.lastRuntimeErrorTime = now;

		const errorInfo = parseJSError(error, countLines(code), THREE_WRAPPER_OFFSET);

		self.postMessage({
			type: 'consoleOutput',
			nodeId,
			level: 'error',
			args: [`Runtime error: ${errorMessage}`],
			lineErrors: errorInfo?.lineErrors
		});
	}

	/**
	 * Handles code execution errors with line number extraction for inline highlighting.
	 */
	handleCodeError(error: unknown): void {
		const { nodeId, code } = this.config;
		const customConsole = this.createCustomConsole();

		const errorInfo = parseJSError(error, countLines(code), THREE_WRAPPER_OFFSET);

		if (errorInfo) {
			self.postMessage({
				type: 'consoleOutput',
				nodeId,
				level: 'error',
				args: [errorInfo.message],
				lineErrors: errorInfo.lineErrors
			});

			return;
		}

		// Fallback: no line info available
		const errorMessage = error instanceof Error ? error.message : String(error);
		customConsole.error(errorMessage);
	}

	/**
	 * Creates a custom console object that routes output to VirtualConsole via the main thread.
	 */
	createCustomConsole() {
		const { nodeId } = this.config;

		const sendLog = (level: 'log' | 'warn' | 'error', args: unknown[]) =>
			self.postMessage({ type: 'consoleOutput', nodeId, level, args });

		return {
			log: (...args: unknown[]) => sendLog('log', args),
			warn: (...args: unknown[]) => sendLog('warn', args),
			error: (...args: unknown[]) => sendLog('error', args),
			info: (...args: unknown[]) => sendLog('log', args),
			debug: (...args: unknown[]) => sendLog('log', args)
		};
	}
}
