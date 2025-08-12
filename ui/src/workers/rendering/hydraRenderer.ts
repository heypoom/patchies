import { Hydra, generators } from 'hydra-ts';
import regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { RenderParams } from '$lib/rendering/types';
import { getFramebuffer } from './utils';
import arrayUtils from 'hydra-ts/src/lib/array-utils';
import type { MessageCallbackFn } from '$lib/messages/MessageSystem';

type AudioAnalysisType = 'waveform' | 'frequency';
type AudioAnalysisFormat = 'int' | 'float';
type AudioAnalysisProps = {
	id?: string;
	type?: AudioAnalysisType;
	format?: AudioAnalysisFormat;
};

// Initialize hydra array utilities.
arrayUtils.init();

export interface HydraConfig {
	code: string;
	nodeId: string;
}

export class HydraRenderer {
	public config: HydraConfig;
	public hydra: Hydra;
	public renderer: FBORenderer;
	public precision: 'highp' | 'mediump' = 'highp';
	public framebuffer: regl.Framebuffer2D | null = null;

	public onMessage: MessageCallbackFn = () => {};

	private timestamp = performance.now();

	private sourceToParamIndexMap: (number | null)[] = [null, null, null, null];

	// FFT state tracking
	public isFFTEnabled = false;
	private fftRequestCache = new Map<string, boolean>();
	private fftDataCache = new Map<string, { data: Uint8Array | Float32Array; timestamp: number }>();

	constructor(config: HydraConfig, framebuffer: regl.Framebuffer2D, renderer: FBORenderer) {
		this.config = config;
		this.framebuffer = framebuffer;
		this.renderer = renderer;

		const [width, height] = this.renderer.outputSize;

		// Initialize Hydra in non-global mode
		this.hydra = new Hydra({
			// @ts-expect-error -- regl version mismatch, but should still work!
			regl: this.renderer.regl,
			width,
			height,
			numSources: 4,
			numOutputs: 4,
			precision: this.precision
		});

		this.updateCode();
	}

	renderFrame(params: RenderParams) {
		const time = performance.now();
		const deltaTime = time - this.timestamp;

		this.hydra.synth.time += deltaTime * 0.001 * this.hydra.synth.speed;
		this.hydra.timeSinceLastUpdate += deltaTime;

		this.hydra.sources.forEach((source, sourceIndex) => {
			// We do the tick ourselves
			if (this.sourceToParamIndexMap[sourceIndex] !== null) {
				const paramIndex = this.sourceToParamIndexMap[sourceIndex];
				const param = params.userParams[paramIndex] as regl.Texture2D;

				// Check if the param is a regl texture
				if (param.name === 'reglTexture2D') {
					source.tex = param;
				}

				return;
			}

			source.tick(this.hydra.synth);
		});

		this.hydra.outputs.forEach((output) => {
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

	private updateCode() {
		this.sourceToParamIndexMap = [null, null, null, null];

		this.isFFTEnabled = false;
		this.fftDataCache.clear();
		this.fftRequestCache.clear();

		try {
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

				initSources: this.initSources.bind(this),

				onMessage: (callback: MessageCallbackFn) => {
					this.onMessage = callback;
				},

				send: this.sendMessage.bind(this),

				// FFT function for audio analysis
				fft: this.createFFTFunction()
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
		this.hydra.hush();
		for (const source of this.hydra.sources) source.clear();
	}

	destroy() {
		this.stop();

		// Destroy all sources and outputs
		for (const source of this.hydra.sources) {
			source.getTexture()?.destroy();
		}

		for (const output of this.hydra.outputs) {
			output.fbos.forEach((fbo) => fbo.destroy());
		}
	}

	initSources(...sources: number[]) {
		if (sources.length === 0) sources = [0];

		sources.forEach((inputIndex, sourceIndex) => {
			// skip mapping if inputIndex is null or undefined
			if (inputIndex === null || inputIndex === undefined) {
				return;
			}

			this.sourceToParamIndexMap[sourceIndex] = inputIndex;
		});
	}

	sendMessage(data: unknown) {
		self.postMessage({
			type: 'sendMessageFromNode',
			fromNodeId: this.config.nodeId,
			data
		});
	}

	createFFTFunction() {
		return (options: AudioAnalysisProps = {}) => {
			const { id, type = 'waveform', format = 'int' } = options;
			const { nodeId } = this.config;

			const cacheKey = `${id ?? 'auto'}-${type}-${format}`;

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

			return cached?.data ?? null;
		};
	}

	// Method to receive FFT data from main thread
	setFFTData(
		id: string | undefined,
		type: AudioAnalysisType,
		format: AudioAnalysisFormat,
		buffer: Uint8Array | Float32Array
	) {
		const cacheKey = `${id ?? 'auto'}-${type}-${format}`;

		this.fftDataCache.set(cacheKey, {
			data: buffer,
			timestamp: performance.now()
		});
	}
}
