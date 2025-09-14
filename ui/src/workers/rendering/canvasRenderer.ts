import type regl from 'regl';
import type { FBORenderer } from './fboRenderer';
import type { Message, MessageCallbackFn } from '$lib/messages/MessageSystem';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem';
import type { SendMessageOptions } from '$lib/messages/MessageContext';
import { FFTAnalysis } from '$lib/audio/FFTAnalysis';

type AudioAnalysisType = 'wave' | 'freq';
type AudioAnalysisFormat = 'int' | 'float';

type AudioAnalysisProps = {
	id?: string;
	type?: AudioAnalysisType;
	format?: AudioAnalysisFormat;
};

export interface CanvasConfig {
	code: string;
	nodeId: string;
}

export class CanvasRenderer {
	public config: CanvasConfig;
	public renderer: FBORenderer;

	public framebuffer: regl.Framebuffer2D | null = null;
	public offscreenCanvas: OffscreenCanvas | null = null;
	public ctx: OffscreenCanvasRenderingContext2D | null = null;
	public canvasTexture: regl.Texture2D | null = null;

	public onMessage: MessageCallbackFn = () => {};

	private timestamp = performance.now();
	private sampleRate: number = 44000;
	private animationId: number | null = null;
	private drawCommand: regl.DrawCommand | null = null;

	// FFT state tracking
	public isFFTEnabled = false;
	private fftRequestCache = new Map<string, boolean>();
	private fftDataCache = new Map<string, { data: Uint8Array | Float32Array; timestamp: number }>();

	private constructor(
		config: CanvasConfig,
		framebuffer: regl.Framebuffer2D,
		renderer: FBORenderer
	) {
		this.config = config;
		this.framebuffer = framebuffer;
		this.renderer = renderer;
	}

	static async create(
		config: CanvasConfig,
		framebuffer: regl.Framebuffer2D,
		renderer: FBORenderer
	): Promise<CanvasRenderer> {
		const instance = new CanvasRenderer(config, framebuffer, renderer);

		const [width, height] = instance.renderer.outputSize;

		instance.offscreenCanvas = new OffscreenCanvas(width, height);
		instance.ctx = instance.offscreenCanvas.getContext('2d');

		if (!instance.ctx) {
			throw new Error('Failed to get 2D context from OffscreenCanvas');
		}

		await instance.updateCode();

		return instance;
	}

	private drawCanvasToTexture() {
		if (!this.ctx || !this.offscreenCanvas || !this.framebuffer) return;

		this.ensureDrawCommand();

		// @ts-expect-error -- regl type is wrong
		this.canvasTexture?.({ data: this.offscreenCanvas, flipY: true });
		this.drawCommand?.();
	}

	ensureDrawCommand() {
		if (this.drawCommand || !this.ctx) return;

		// @ts-expect-error -- regl type is wrong
		this.canvasTexture = this.renderer.regl.texture({
			data: this.offscreenCanvas,
			flipY: true
		});

		this.drawCommand = this.renderer.regl({
			framebuffer: this.framebuffer,
			vert: `
				attribute vec2 position;
				varying vec2 uv;
				void main() {
					uv = position * 0.5 + 0.5;
					gl_Position = vec4(position, 0, 1);
				}
			`,
			frag: `
				precision mediump float;
				varying vec2 uv;
				uniform sampler2D canvasTexture;

				void main() {
					gl_FragColor = texture2D(canvasTexture, vec2(uv.x, 1.0 - uv.y));
				}
			`,
			attributes: {
				position: [
					[-1, -1],
					[1, -1],
					[-1, 1],
					[1, 1]
				]
			},
			uniforms: { canvasTexture: this.canvasTexture },
			primitive: 'triangle strip',
			count: 4
		});
	}

	public async updateCode() {
		if (!this.ctx || !this.offscreenCanvas) return;

		this.isFFTEnabled = false;
		this.fftDataCache.clear();
		this.fftRequestCache.clear();

		// Cancel any existing animation frame
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}

		try {
			const [width, height] = this.renderer.outputSize;

			// Set canvas size
			this.offscreenCanvas.width = width;
			this.offscreenCanvas.height = height;

			// Create extra context for canvas-specific functionality
			const extraContext = {
				canvas: this.offscreenCanvas,
				ctx: this.ctx,
				width: width,
				height: height,

				requestAnimationFrame: (callback: FrameRequestCallback) => {
					this.animationId = requestAnimationFrame(() => {
						callback(performance.now());
						this.drawCanvasToTexture();
					});

					return this.animationId;
				},

				cancelAnimationFrame: (id: number) => {
					cancelAnimationFrame(id);
					if (this.animationId === id) {
						this.animationId = null;
					}
				},

				// FFT function for audio analysis
				fft: this.createFFTFunction(),

				onMessage: (callback: MessageCallbackFn) => {
					this.onMessage = callback;
				}
			};

			const processedCode = await this.renderer.jsRunner.preprocessCode(this.config.code, {
				nodeId: this.config.nodeId,
				setLibraryName: () => {}
			});

			if (processedCode === null) return;

			// Use JSRunner's executeJavaScript method with full module support
			await this.renderer.jsRunner.executeJavaScript(this.config.nodeId, processedCode, {
				customConsole: {
					log: (...args) => console.log(`[canvas ${this.config.nodeId}]`, ...args),
					error: (...args) => console.error(`[canvas ${this.config.nodeId}]`, ...args),
					warn: (...args) => console.warn(`[canvas ${this.config.nodeId}]`, ...args)
				},
				setPortCount: (inletCount?: number, outletCount?: number) => {
					this.setPortCount(inletCount, outletCount);
				},
				extraContext
			});
		} catch (error) {
			console.error('Error executing canvas code:', error);
		}
	}

	destroy() {
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}

		// Clean up JSRunner context for this node
		this.renderer.jsRunner.destroy(this.config.nodeId);

		this.offscreenCanvas = null;
		this.ctx = null;
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

	handleMessage(message: Message) {
		this.onMessage?.(message.data, message);
	}
}
