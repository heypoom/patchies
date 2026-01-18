import type regl from 'regl';
import type { FBONode, PreviewState } from '../../lib/rendering/types';
import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
import { getFramebuffer } from './utils';
import type { RenderingProfiler } from './RenderingProfiler';

/**
 * PreviewRenderer handles GPU-to-CPU pixel readback for node previews.
 *
 * Uses synchronous reads with round-robin throttling to maintain performance.
 * Previews are rendered in batches (maxPreviewsPerFrame) to avoid overwhelming
 * the GPU with readback operations.
 */
export class PreviewRenderer {
	private gl: WebGL2RenderingContext;
	private regl: regl.Regl;
	private profiler: RenderingProfiler;

	// Preview state
	private previewState: PreviewState = {};
	private previewRoundRobinIndex = 0;

	// Size configuration
	public outputSize: [number, number];
	public previewSize: [number, number];

	// Throttling configuration
	public maxPreviewsPerFrame = 4;
	public maxPreviewsPerFrameNoOutput = 4;

	// Canvas cache for ImageBitmap creation
	private canvasCache = new Map<
		string,
		{ canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D }
	>();

	// Reusable preview FBO (avoids per-frame allocation)
	private previewFbo: regl.Framebuffer2D | null = null;
	private previewTexture: regl.Texture2D | null = null;

	constructor(
		gl: WebGL2RenderingContext,
		reglInstance: regl.Regl,
		profiler: RenderingProfiler,
		outputSize: [number, number]
	) {
		this.gl = gl;
		this.regl = reglInstance;
		this.profiler = profiler;
		this.outputSize = outputSize;
		this.previewSize = [
			Math.floor(outputSize[0] / PREVIEW_SCALE_FACTOR),
			Math.floor(outputSize[1] / PREVIEW_SCALE_FACTOR)
		];
		this.createPreviewFbo();
	}

	private createPreviewFbo(): void {
		const [width, height] = this.previewSize;

		this.previewTexture = this.regl.texture({
			width,
			height,
			wrapS: 'clamp',
			wrapT: 'clamp'
		});

		this.previewFbo = this.regl.framebuffer({
			color: this.previewTexture,
			depthStencil: false
		});
	}

	// ===== Public API =====

	setPreviewEnabled(nodeId: string, enabled: boolean): void {
		this.previewState[nodeId] = enabled;
	}

	isPreviewEnabled(nodeId: string): boolean {
		return this.previewState[nodeId] ?? false;
	}

	getEnabledPreviews(): string[] {
		return Object.keys(this.previewState).filter((nodeId) => this.previewState[nodeId]);
	}

	hasEnabledPreviews(): boolean {
		return this.getEnabledPreviews().length > 0;
	}

	setPreviewSize(width: number, height: number): void {
		this.previewSize = [width, height];

		// Recreate preview FBO with new size
		this.previewFbo?.destroy();
		this.previewTexture?.destroy();
		this.createPreviewFbo();
	}

	setOutputSize(outputSize: [number, number]): void {
		this.outputSize = outputSize;
	}

	removeNode(nodeId: string): void {
		delete this.previewState[nodeId];
	}

	/**
	 * Main entry point: render previews for this frame.
	 * Uses round-robin throttling to limit reads per frame.
	 */
	renderPreviewBitmaps(
		fboNodes: Map<string, FBONode>,
		isOutputEnabled: boolean,
		getCustomSize?: (nodeId: string) => [number, number] | undefined
	): Map<string, ImageBitmap> {
		const results = new Map<string, ImageBitmap>();

		const enabledPreviews = this.getEnabledPreviews();
		if (enabledPreviews.length === 0) return results;

		const maxLimit = isOutputEnabled ? this.maxPreviewsPerFrame : this.maxPreviewsPerFrameNoOutput;
		const nodesToRender = this.selectNodesForFrame(enabledPreviews, maxLimit);

		for (const nodeId of nodesToRender) {
			const fboNode = fboNodes.get(nodeId);
			if (!fboNode) continue;

			const customSize = getCustomSize?.(nodeId);
			const bitmap = this.renderNodePreview(fboNode, customSize);
			if (bitmap) {
				results.set(nodeId, bitmap);
			}
		}

		return results;
	}

	/**
	 * Render a single node's preview and return an ImageBitmap.
	 */
	private renderNodePreview(fboNode: FBONode, customSize?: [number, number]): ImageBitmap | null {
		const [pw, ph] = customSize ?? this.previewSize;
		const width = Math.floor(pw);
		const height = Math.floor(ph);

		if (width <= 0 || height <= 0) return null;

		const [sourceWidth, sourceHeight] = this.outputSize;
		const { canvas, ctx } = this.getCanvas(width, height);

		this.ensurePreviewFboSize(width, height);

		const gl = this.gl;
		const sourceFBO = getFramebuffer(fboNode.framebuffer);
		const destFBO = getFramebuffer(this.previewFbo!);

		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destFBO);

		// FlipY during blit by swapping destination Y coordinates
		gl.blitFramebuffer(
			0,
			0,
			sourceWidth,
			sourceHeight,
			0,
			height,
			width,
			0,
			gl.COLOR_BUFFER_BIT,
			gl.LINEAR
		);

		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, destFBO);

		const pixels = this.timedRead(width, height);

		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

		const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
		ctx.putImageData(imageData, 0, 0);

		return canvas.transferToImageBitmap();
	}

	/**
	 * Synchronous single-node preview capture.
	 * Used for on-demand captures (e.g., export, Gemini).
	 */
	capturePreviewBitmapSync(
		framebuffer: regl.Framebuffer2D,
		sourceWidth: number,
		sourceHeight: number,
		customSize?: [number, number]
	): ImageBitmap {
		const [pw, ph] = customSize ?? this.previewSize;
		const width = Math.floor(pw);
		const height = Math.floor(ph);

		const { canvas, ctx } = this.getCanvas(width, height);

		this.ensurePreviewFboSize(width, height);

		const gl = this.gl;
		const sourceFBO = getFramebuffer(framebuffer);
		const destFBO = getFramebuffer(this.previewFbo!);

		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destFBO);

		// FlipY during blit
		gl.blitFramebuffer(
			0,
			0,
			sourceWidth,
			sourceHeight,
			0,
			height,
			width,
			0,
			gl.COLOR_BUFFER_BIT,
			gl.LINEAR
		);

		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, destFBO);

		const pixels = this.timedRead(width, height);

		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

		const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
		ctx.putImageData(imageData, 0, 0);

		return canvas.transferToImageBitmap();
	}

	// ===== Helpers =====

	private selectNodesForFrame(enabledPreviews: string[], maxLimit: number): string[] {
		if (maxLimit <= 0 || enabledPreviews.length <= maxLimit) {
			return enabledPreviews;
		}

		// Round-robin selection
		const selected: string[] = [];
		for (let i = 0; i < maxLimit; i++) {
			const idx = (this.previewRoundRobinIndex + i) % enabledPreviews.length;
			selected.push(enabledPreviews[idx]);
		}

		this.previewRoundRobinIndex = (this.previewRoundRobinIndex + maxLimit) % enabledPreviews.length;

		return selected;
	}

	private getCanvas(
		width: number,
		height: number
	): { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
		const key = `${width}x${height}`;
		let cached = this.canvasCache.get(key);

		if (!cached) {
			const canvas = new OffscreenCanvas(width, height);
			const ctx = canvas.getContext('2d')!;
			cached = { canvas, ctx };
			this.canvasCache.set(key, cached);
		}

		return cached;
	}

	private ensurePreviewFboSize(width: number, height: number): void {
		if (
			this.previewTexture &&
			this.previewTexture.width === width &&
			this.previewTexture.height === height
		) {
			return;
		}

		this.previewFbo?.destroy();
		this.previewTexture?.destroy();

		this.previewTexture = this.regl.texture({
			width,
			height,
			wrapS: 'clamp',
			wrapT: 'clamp'
		});

		this.previewFbo = this.regl.framebuffer({
			color: this.previewTexture,
			depthStencil: false
		});
	}

	private timedRead(width: number, height: number): Uint8Array {
		const size = width * height * 4;
		const pixels = new Uint8Array(size);

		if (!this.profiler.isEnabled) {
			this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
			return pixels;
		}

		const start = performance.now();
		this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
		this.profiler.recordReglRead(performance.now() - start);

		return pixels;
	}

	destroy(): void {
		this.previewFbo?.destroy();
		this.previewTexture?.destroy();
	}
}
