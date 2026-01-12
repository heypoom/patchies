import type { Hydra, HydraErrorContext } from '$lib/hydra';
import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import { getFramebuffer } from './utils';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { FFTAnalysis } from '$lib/audio/FFTAnalysis';
import { parseJSError, countLines } from '$lib/js-runner/js-error-parser';
import { HYDRA_WRAPPER_OFFSET } from '$lib/constants/error-reporting-offsets';

type AudioAnalysisType = 'wave' | 'freq';
type AudioAnalysisFormat = 'int' | 'float';

type AudioAnalysisProps = {
	id?: string;
	type?: AudioAnalysisType;
	format?: AudioAnalysisFormat;
};

export interface HydraConfig {
	code: string;
	nodeId: string;
}

export class HydraRenderer {
	public config: HydraConfig;
	public renderer: FBORenderer;
	public precision: 'highp' | 'mediump' = 'highp';

	public hydra: Hydra | null = null;
	public framebuffer: regl.Framebuffer2D | null = null;

	public onMessage: MessageCallbackFn = () => {};

	private timestamp = performance.now();

	private sourceToParamIndexMap: (number | null)[] = [null, null, null, null];

	// FFT state tracking
	public isFFTEnabled = false;
	private fftRequestCache = new Map<string, boolean>();
	private fftDataCache = new Map<string, { data: Uint8Array | Float32Array; timestamp: number }>();

	// Mouse state (updated each frame from RenderParams)
	private mouseX = 0;
	private mouseY = 0;

	// Mouse scope: 'local' = canvas-relative, 'global' = screen-relative
	private mouseScope: 'global' | 'local' = 'local';

	// Runtime error throttling (avoid flooding console at 120fps)
	private lastRuntimeError: string | null = null;
	private lastRuntimeErrorTime = 0;
	private static readonly RUNTIME_ERROR_THROTTLE_MS = 1000;

	private constructor(config: HydraConfig, framebuffer: regl.Framebuffer2D, renderer: FBORenderer) {
		this.config = config;
		this.framebuffer = framebuffer;
		this.renderer = renderer;
	}

	static async create(
		config: HydraConfig,
		framebuffer: regl.Framebuffer2D,
		renderer: FBORenderer
	): Promise<HydraRenderer> {
		const { Hydra } = await import('$lib/hydra');
		const arrayUtils = await import('$lib/hydra/lib/array-utils');

		arrayUtils.default.init();

		const instance = new HydraRenderer(config, framebuffer, renderer);

		const [width, height] = instance.renderer.outputSize;

		instance.hydra = new Hydra({
			regl: instance.renderer.regl,
			width,
			height,
			numSources: 4,
			numOutputs: 4,
			precision: instance.precision,
			onError: (error, context) => instance.handleRuntimeError(error, context)
		});

		await instance.updateCode();

		return instance;
	}

	renderFrame(params: RenderParams) {
		if (!this.hydra) return;

		// Update mouse state from render params
		this.mouseX = params.mouseX;
		this.mouseY = params.mouseY;

		const time = performance.now();
		const deltaTime = time - this.timestamp;

		this.hydra.synth.time += deltaTime * 0.001 * this.hydra.synth.speed;
		this.hydra.timeSinceLastUpdate += deltaTime;

		this.hydra.sources.forEach((source, sourceIndex) => {
			if (!this.hydra) return;

			// We do the tick ourselves
			if (this.sourceToParamIndexMap[sourceIndex] !== null) {
				const paramIndex = this.sourceToParamIndexMap[sourceIndex];

				const param = params.userParams[paramIndex] as regl.Texture2D;
				if (!param) return;

				// Check if the param is a valid regl texture - use property detection
				// instead of name checking since names get mangled in production
				if (
					'width' in param &&
					'height' in param &&
					// @ts-expect-error -- internal regl property
					param._reglType === 'texture2d'
				) {
					source.tex = param;
				}

				return;
			}

			source.tick();
		});

		this.hydra.outputs.forEach((output) => {
			if (!this.hydra) return;

			output.tick(this.hydra.synth);
		});

		const hydraFramebuffer = this.hydra.output.getCurrent();
		const gl = this.renderer.gl;

		const [hydraWidth, hydraHeight] = this.hydra.synth.resolution;
		const [outputWidth, outputHeight] = this.renderer.outputSize;

		if (!gl) return;

		const sourceFBO = getFramebuffer(hydraFramebuffer);
		const destPreviewFBO = getFramebuffer(this.framebuffer);

		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destPreviewFBO);

		// Flip Y coordinates to match standard screen coordinates (Y-down, origin top-left)
		gl.blitFramebuffer(
			0,
			0,
			hydraWidth,
			hydraHeight,
			0,
			outputHeight, // Flip destination Y
			outputWidth,
			0,
			gl.COLOR_BUFFER_BIT,
			gl.LINEAR
		);

		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

		this.hydra.timeSinceLastUpdate = 0;
		this.timestamp = time;
	}

	public async updateCode() {
		if (!this.hydra) return;

		this.sourceToParamIndexMap = [null, null, null, null];

		this.isFFTEnabled = false;
		this.fftDataCache.clear();
		this.fftRequestCache.clear();

		// Reset mouse scope to local (default)
		this.mouseScope = 'local';

		try {
			const { generators } = await import('$lib/hydra');

			const { src, osc, gradient, shape, voronoi, noise, solid } = generators;
			const { sources, outputs, hush, render } = this.hydra;

			const [s0, s1, s2, s3] = sources;
			const [o0, o1, o2, o3] = outputs;

			// Clear any existing patterns
			this.stop();

			// Create a context with Hydra synth instance available as 'h'
			// Also destructure common functions for easier access
			const context = {
				h: this.hydra.synth,
				render,
				hush,

				// Generators
				osc,
				gradient,
				shape,
				voronoi,
				noise,
				src,
				solid,

				// Sources
				s0,
				s1,
				s2,
				s3,

				// Outputs
				o0,
				o1,
				o2,
				o3,

				setVideoCount: this.setVideoCount.bind(this),

				onMessage: (callback: MessageCallbackFn) => {
					this.onMessage = callback;
				},

				send: this.sendMessage.bind(this),

				// FFT function for audio analysis
				fft: this.createFFTFunction(),

				// setPortCount function for dynamic port management
				setPortCount: (inletCount?: number, outletCount?: number) => {
					this.setPortCount(inletCount, outletCount);
				},

				// setTitle function to update node title
				setTitle: this.setTitle.bind(this),

				// Mouse object with getters for real-time values (Hydra-style)
				mouse: this.createMouseObject(),

				// Set mouse scope: 'local' (canvas-relative) or 'global' (screen-relative)
				setMouseScope: this.setMouseScope.bind(this),

				// Canvas dimensions for normalizing mouse coordinates
				width: this.renderer.outputSize[0],
				height: this.renderer.outputSize[1],

				// Custom console that routes to VirtualConsole
				console: this.createCustomConsole()
			};

			const userFunction = new Function(
				'context',
				`
				let time = performance.now()

				with (context) {
					var recv = onMessage; // alias for onMessage

					${processCode(this.config.code)}
				}
			`
			);

			userFunction(context);
		} catch (error) {
			this.handleCodeError(error);
		}
	}

	stop() {
		if (!this.hydra) return;

		this.hydra.hush();

		for (const source of this.hydra.sources) source.clear();
	}

	destroy() {
		if (!this.hydra) return;

		this.stop();

		// Destroy all sources and outputs
		for (const source of this.hydra.sources) {
			source.getTexture()?.destroy();
		}

		for (const output of this.hydra.outputs) {
			output.fbos.forEach((fbo) => fbo.destroy());
		}
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

			return new FFTAnalysis(bins, format, 44000);
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
		const { analysisType, format, array } = payload;

		const cacheKey = `${analysisType}-${format}`;

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

	setVideoCount(inletCount = 1, outletCount = 1) {
		// hydra allows max 4 inlets and outlets
		inletCount = Math.min(inletCount, 4);
		outletCount = Math.min(outletCount, 4);

		self.postMessage({
			type: 'setPortCount',
			portType: 'video',
			nodeId: this.config.nodeId,
			inletCount,
			outletCount
		});

		for (let i = 0; i < inletCount; i++) {
			this.sourceToParamIndexMap[i] = i;
		}
	}

	setTitle(title: string) {
		self.postMessage({
			type: 'setTitle',
			nodeId: this.config.nodeId,
			title
		});
	}

	setMouseScope(scope: 'global' | 'local') {
		this.mouseScope = scope;

		self.postMessage({
			type: 'setMouseScope',
			nodeId: this.config.nodeId,
			scope
		});
	}

	/**
	 * Handles runtime errors from Hydra transforms (e.g., errors in arrow functions passed to osc(), rotate(), etc.)
	 * These errors occur during rendering, not during initial code evaluation.
	 * Throttled to avoid flooding console at high frame rates.
	 */
	handleRuntimeError(error: unknown, context: HydraErrorContext): void {
		const { nodeId, code } = this.config;
		const errorMessage = error instanceof Error ? error.message : String(error);

		// Create a key to identify this specific error
		const errorKey = `${context.transformName}:${context.paramName}:${errorMessage}`;
		const now = performance.now();

		// Throttle: skip if same error was reported recently
		if (
			this.lastRuntimeError === errorKey &&
			now - this.lastRuntimeErrorTime < HydraRenderer.RUNTIME_ERROR_THROTTLE_MS
		) {
			return;
		}

		this.lastRuntimeError = errorKey;
		this.lastRuntimeErrorTime = now;

		// Format a helpful error message with context
		const contextInfo =
			context.transformType === 'render'
				? 'during render'
				: `in ${context.transformName}() parameter "${context.paramName}"`;

		// Try to extract line number from stack trace
		const errorInfo = parseJSError(error, countLines(code), HYDRA_WRAPPER_OFFSET);

		self.postMessage({
			type: 'consoleOutput',
			nodeId,
			level: 'error',
			args: [`Error ${contextInfo}: ${errorMessage}`],
			lineErrors: errorInfo?.lineErrors
		});
	}

	/**
	 * Handles code execution errors with line number extraction for inline highlighting.
	 * Parses the error to extract line info and sends it via consoleOutput with lineErrors.
	 */
	handleCodeError(error: unknown): void {
		const { nodeId, code } = this.config;
		const customConsole = this.createCustomConsole();

		const errorInfo = parseJSError(error, countLines(code), HYDRA_WRAPPER_OFFSET);

		if (errorInfo) {
			// Send error with lineErrors for inline highlighting
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

const processCode = (code: string) => code.replace('.out()', '.out(o0)');
