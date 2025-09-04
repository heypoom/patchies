import type { Hydra } from 'hydra-ts';
import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import { getFramebuffer } from './utils';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem';
import type { SendMessageOptions } from '$lib/messages/MessageContext';

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
		const hydraModule = await import('hydra-ts');
		const arrayUtils = await import('hydra-ts/src/lib/array-utils');

		arrayUtils.default.init();

		const instance = new HydraRenderer(config, framebuffer, renderer);

		const [width, height] = instance.renderer.outputSize;

		instance.hydra = new hydraModule.Hydra({
			// @ts-expect-error -- regl version mismatch, but should still work!
			regl: instance.renderer.regl,
			width,
			height,
			numSources: 4,
			numOutputs: 4,
			precision: instance.precision
		});

		await instance.updateCode();
		return instance;
	}

	renderFrame(params: RenderParams) {
		if (!this.hydra) return;

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

				// Check if the param is a regl texture
				if (param.name === 'reglTexture2D') {
					source.tex = param;
				}

				return;
			}

			source.tick(this.hydra.synth);
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

		gl.blitFramebuffer(
			0,
			0,
			hydraWidth,
			hydraHeight,
			0,
			0,
			outputWidth,
			outputHeight,
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

		try {
			const { generators } = await import('hydra-ts');

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
				setPortCount: (inletCount = 1, outletCount = 1) => {
					this.setPortCount(inletCount, outletCount);
				}
			};

			const userFunction = new Function(
				'context',
				`
				let time = performance.now()

				with (context) {
					var recv = receive = listen = onMessage; // alias for onMessage

					${this.config.code}
				}
			`
			);

			userFunction(context);
		} catch (error) {
			console.error('Error executing Hydra code:', error);
			throw error;
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

			return cached?.data ?? this.getEmpty(format);
		};
	}

	getEmpty(format: AudioAnalysisFormat) {
		if (format === 'float') return new Float32Array();

		return new Uint8Array();
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
}
