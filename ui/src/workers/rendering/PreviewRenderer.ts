import type regl from 'regl';
import type { FBONode, PreviewState } from '../../lib/rendering/types';
import { PREVIEW_SCALE_FACTOR } from '$lib/canvas/constants';
import { getFramebuffer } from './utils';
import type { RenderingProfiler } from './RenderingProfiler';

interface PendingRead {
	pbo: WebGLBuffer;
	width: number;
	height: number;
	sync: WebGLSync;
	nodeId: string;
}

/**
 * PreviewRenderer handles GPU-to-CPU pixel readback for node previews.
 *
 * Uses PBO (Pixel Buffer Object) async reads with frame rate limiting:
 * - Previews update at ~30fps (every 2 frames at 60fps render rate)
 * - Batch all preview reads in one frame, retrieve results 2+ frames later
 * - Non-blocking retrieval: skip if GPU isn't ready yet
 *
 * This eliminates GPU stalls from readPixels while keeping previews responsive.
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

	// Frame rate limiting for previews (in ms)
	private previewIntervalMs = Math.round(1000 / 40); // 40fps max for previews
	private lastPreviewTime = 0;

	// PBO async read state
	private pboPool: WebGLBuffer[] = [];
	private pendingReads: PendingRead[] = [];

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
		this.previewFbo?.destroy();
		this.previewTexture?.destroy();
		this.createPreviewFbo();
	}

	setOutputSize(outputSize: [number, number]): void {
		this.outputSize = outputSize;
	}

	removeNode(nodeId: string): void {
		delete this.previewState[nodeId];
		// Clean up any pending reads for this node
		this.pendingReads = this.pendingReads.filter((p) => {
			if (p.nodeId === nodeId) {
				this.gl.deleteSync(p.sync);
				this.returnPbo(p.pbo);
				return false;
			}
			return true;
		});
	}

	/**
	 * Main entry point: render previews using async PBO reads.
	 *
	 * Flow:
	 * 1. Check for completed async reads and create bitmaps (non-blocking)
	 * 2. If enough time has passed, initiate new batch of reads
	 *
	 * Returns bitmaps that are ready (may be empty if nothing completed yet).
	 */
	renderPreviewBitmaps(
		fboNodes: Map<string, FBONode>,
		isOutputEnabled: boolean,
		getCustomSize?: (nodeId: string) => [number, number] | undefined
	): Map<string, ImageBitmap> {
		const results = new Map<string, ImageBitmap>();

		// Step 1: Harvest any completed reads (non-blocking)
		this.harvestCompletedReads(results);

		// Step 2: Check if we should initiate new reads (frame rate limiting)
		const now = performance.now();
		if (now - this.lastPreviewTime < this.previewIntervalMs) {
			return results;
		}
		this.lastPreviewTime = now;

		// Step 3: Initiate new batch of async reads
		const enabledPreviews = this.getEnabledPreviews();
		if (enabledPreviews.length === 0) return results;

		const maxLimit = isOutputEnabled ? this.maxPreviewsPerFrame : this.maxPreviewsPerFrameNoOutput;
		const nodesToRead = this.selectNodesForFrame(enabledPreviews, maxLimit);

		for (const nodeId of nodesToRead) {
			const fboNode = fboNodes.get(nodeId);
			if (!fboNode) continue;

			const customSize = getCustomSize?.(nodeId);
			this.initiateAsyncRead(nodeId, fboNode.framebuffer, customSize);
		}

		return results;
	}

	/**
	 * Harvest completed async reads without blocking.
	 * Uses clientWaitSync with 0 timeout to check if ready.
	 */
	private harvestCompletedReads(results: Map<string, ImageBitmap>): void {
		const gl = this.gl;
		const stillPending: PendingRead[] = [];

		for (const pending of this.pendingReads) {
			const { pbo, width, height, sync, nodeId } = pending;

			// Non-blocking check: is the GPU done?
			const status = gl.clientWaitSync(sync, 0, 0);

			if (status === gl.TIMEOUT_EXPIRED || status === gl.WAIT_FAILED) {
				// Not ready yet, keep waiting
				stillPending.push(pending);
				continue;
			}

			// Ready! (ALREADY_SIGNALED or CONDITION_SATISFIED)
			gl.deleteSync(sync);

			// Read the data (should be instant since GPU is done)
			const size = width * height * 4;
			const pixels = new Uint8Array(size);

			gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);

			const start = this.profiler.isEnabled ? performance.now() : 0;
			gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);
			if (this.profiler.isEnabled) {
				this.profiler.recordReglRead(performance.now() - start);
			}

			gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
			this.returnPbo(pbo);

			// Create bitmap
			const { canvas, ctx } = this.getCanvas(width, height);
			const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
			ctx.putImageData(imageData, 0, 0);
			results.set(nodeId, canvas.transferToImageBitmap());
		}

		this.pendingReads = stillPending;
	}

	/**
	 * Initiate an async read using PBO.
	 * readPixels with PBO bound returns immediately.
	 */
	private initiateAsyncRead(
		nodeId: string,
		framebuffer: regl.Framebuffer2D,
		customSize?: [number, number]
	): void {
		const [pw, ph] = customSize ?? this.previewSize;
		const width = Math.floor(pw);
		const height = Math.floor(ph);

		if (width <= 0 || height <= 0) return;

		const [sourceWidth, sourceHeight] = this.outputSize;
		const gl = this.gl;

		this.ensurePreviewFboSize(width, height);

		// Blit source to preview FBO with flip
		const sourceFBO = getFramebuffer(framebuffer);
		const destFBO = getFramebuffer(this.previewFbo!);

		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destFBO);

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

		// Setup PBO for async read
		const pbo = this.getPbo();
		const size = width * height * 4;

		gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
		gl.bufferData(gl.PIXEL_PACK_BUFFER, size, gl.STREAM_READ);

		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, destFBO);

		// This returns immediately - GPU transfer happens async
		gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, 0);

		// Create fence sync to know when read is complete
		const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;

		gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

		this.pendingReads.push({ pbo, width, height, sync, nodeId });
	}

	// ===== PBO Pool =====

	private getPbo(): WebGLBuffer {
		if (this.pboPool.length > 0) {
			return this.pboPool.pop()!;
		}
		return this.gl.createBuffer()!;
	}

	private returnPbo(pbo: WebGLBuffer): void {
		this.pboPool.push(pbo);
	}

	// ===== Sync Capture (for on-demand use) =====

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

		const pixels = this.timedSyncRead(width, height);

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

	private timedSyncRead(width: number, height: number): Uint8Array {
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
		// Clean up pending reads
		for (const pending of this.pendingReads) {
			this.gl.deleteSync(pending.sync);
			this.gl.deleteBuffer(pending.pbo);
		}
		this.pendingReads = [];

		// Clean up PBO pool
		for (const pbo of this.pboPool) {
			this.gl.deleteBuffer(pbo);
		}
		this.pboPool = [];

		this.previewFbo?.destroy();
		this.previewTexture?.destroy();
	}
}
