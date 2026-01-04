import type regl from 'regl';
import type { AudioAnalysisPayloadWithType } from '$lib/audio/AudioAnalysisSystem';
import type { Message } from '$lib/messages/MessageSystem';
import type { RenderGraph } from '$lib/rendering/types';
import type { VideoContext } from './VideoContext';
import type { VideoNodeV2, VideoStores } from './interfaces/video-nodes';
import { FBORenderer } from '../fboRenderer';
import { FFTStore } from './stores/FFTStore';
import { TextureStore } from './stores/TextureStore';
import { UniformsStore } from './stores/UniformsStore';
import { VideoRegistry } from './VideoRegistry';
import { capturePreview, captureTexturePreview, blitToOutput } from './PreviewHelper';
import { logger } from '$lib/utils/logger';

/**
 * VideoWorkerService is the main orchestrator for the V2 video rendering system.
 * It manages the render graph, coordinates between V2 nodes and V1 fallback,
 * and handles the render loop.
 *
 * Key principle: NO node type checks. All node-specific logic lives in node classes.
 */
export class VideoWorkerService {
	/** Video context with shared WebGL resources */
	readonly ctx: VideoContext;

	/** Persistent stores */
	readonly uniformsStore: UniformsStore;
	readonly fftStore: FFTStore;
	readonly textureStore: TextureStore;

	/** Video node registry */
	readonly registry: VideoRegistry;

	/** V2 video nodes */
	private nodes = new Map<string, VideoNodeV2>();

	/** Current render graph */
	private renderGraph: RenderGraph | null = null;

	/** Node ID connected to bg.out (final output) */
	private outputNodeId: string | null = null;

	/** Pause state per node (managed by service) */
	private pausedNodes = new Set<string>();

	/** Whether preview is enabled for each of the nodes */
	private previewEnabledById: Record<string, boolean> = {};

	/** V1 fallback renderer */
	private v1: FBORenderer;

	/** Render loop state */
	private isAnimating = false;
	private frameCancellable: regl.Cancellable | null = null;
	private startTime = Date.now();
	private lastTime = 0;
	private frameCount = 0;

	constructor(ctx: VideoContext) {
		this.ctx = ctx;
		this.registry = VideoRegistry.getInstance();
		this.uniformsStore = new UniformsStore();
		this.fftStore = new FFTStore();
		this.textureStore = new TextureStore();

		// V1 fallback - will be removed once all nodes are migrated
		this.v1 = new FBORenderer();
	}

	/**
	 * Build the render graph, creating nodes as needed.
	 * Uses V2 nodes where available, falls back to V1 FBORenderer.
	 */
	async buildGraph(graph: RenderGraph): Promise<void> {
		this.renderGraph = graph;
		this.outputNodeId = graph.outputNodeId;

		// Destroy existing nodes
		for (const node of this.nodes.values()) {
			node.destroy?.();
		}

		this.nodes.clear();

		// Create V2 nodes for registered types
		const stores = this.getStores();

		for (const renderNode of graph.nodes) {
			const NodeClass = this.registry.get(renderNode.type);

			if (NodeClass) {
				const node = new NodeClass(renderNode.id, this.ctx);
				this.nodes.set(renderNode.id, node);

				await node.create?.(renderNode.data, stores);

				// Enable preview by default
				this.previewEnabledById[renderNode.id] = true;
			}
		}

		await this.v1.buildFBOs(graph);
	}

	/**
	 * Start the render loop.
	 */
	startLoop(onFrame: () => void): void {
		this.stopLoop();
		this.isAnimating = true;

		// WORKAROUND: Start V1 render loop to initialize shared WebGL/regl time context
		// When V1 and V2 share the same WebGL context, V1's regl.frame() needs to run
		// for time to propagate correctly. Once all nodes are migrated to V2, we can remove this.
		this.v1.startRenderLoop(() => {});

		this.frameCancellable = this.ctx.regl.frame(() => {
			if (!this.isAnimating) {
				this.frameCancellable?.cancel();
				return;
			}

			this.renderFrame();
			onFrame?.();
		});
	}

	/**
	 * Stop the render loop.
	 */
	stopLoop(): void {
		this.isAnimating = false;
		this.frameCancellable?.cancel();
		this.v1.stopRenderLoop();
	}

	/** Render a single frame. */
	renderFrame(): void {
		if (!this.renderGraph) {
			logger.warn('[VideoWorkerService.renderFrame] No render graph');
			return;
		}

		// Update time
		const currentTime = (Date.now() - this.startTime) / 1000;
		this.lastTime = currentTime;
		this.frameCount++;

		const params = {
			lastTime: this.lastTime,
			iFrame: this.frameCount,
			mouseX: 0,
			mouseY: 0,
			userParams: []
		};

		// Render V2 nodes in topological order
		for (const nodeId of this.renderGraph.sortedNodes) {
			const node = this.nodes.get(nodeId);

			if (node) {
				// Skip if paused
				if (this.isNodePaused(nodeId)) continue;

				// Get input textures from render graph
				const renderNode = this.renderGraph.nodes.find((n) => n.id === nodeId);
				const inputs = this.getInputTextures(renderNode);

				// Render the node
				if (node.render) {
					node.render(params, inputs);
				}
			}
		}

		this.v1.renderFrame();

		// Render to main output canvas (only if we have an explicit output node like bg.out)
		if (this.outputNodeId) {
			const outputNode = this.nodes.get(this.outputNodeId);

			if (outputNode) {
				blitToOutput(this.ctx, outputNode.framebuffer);
			}
		}
	}

	/**
	 * Render previews for all enabled nodes.
	 */
	renderNodePreviews(): Map<string, Uint8Array> {
		const previewPixels = new Map<string, Uint8Array>();

		const enabledPreviews = Object.keys(this.previewEnabledById).filter(
			(id) => this.previewEnabledById[id]
		);

		for (const nodeId of enabledPreviews) {
			const nodeV2 = this.nodes.get(nodeId);

			if (nodeV2) {
				const pixels = capturePreview(this.ctx, nodeV2.framebuffer);

				previewPixels.set(nodeId, pixels);
			}
		}

		// Also get V1 previews
		const previewsV1 = this.v1.renderPreviews();

		for (const [nodeId, pixels] of previewsV1) {
			previewPixels.set(nodeId, pixels);
		}

		return previewPixels;
	}

	/**
	 * Enable or disable preview for a node.
	 */
	setNodePreviewEnabled(nodeId: string, enabled: boolean): void {
		this.previewEnabledById[nodeId] = enabled;
		this.v1.setPreviewEnabled(nodeId, enabled);
	}

	/**
	 * Set uniform data for a node.
	 */
	setUniformData(
		nodeId: string,
		uniformName: string,
		uniformValue: number | boolean | number[]
	): void {
		this.uniformsStore.set(nodeId, uniformName, uniformValue);
		this.v1.setUniformData(nodeId, uniformName, uniformValue);
	}

	/**
	 * Send a message to a node.
	 * NO type checks - nodes handle their own messages.
	 */
	sendMessage(nodeId: string, message: Message): void {
		const v2Node = this.nodes.get(nodeId);

		if (v2Node?.onMessage) {
			v2Node.onMessage(message.data, message);
			return;
		}

		this.v1.sendMessageToNode(nodeId, message);
	}

	/**
	 * Set FFT data for nodes that support it.
	 */
	setFFTData(payload: AudioAnalysisPayloadWithType): void {
		this.fftStore.updateFromPayload(payload, this.ctx.regl);
		this.v1.setFFTAsGlslUniforms(payload);
	}

	/**
	 * Toggle pause state for a node.
	 */
	toggleNodePause(nodeId: string): void {
		if (this.pausedNodes.has(nodeId)) {
			this.pausedNodes.delete(nodeId);
		} else {
			this.pausedNodes.add(nodeId);
		}

		this.v1.toggleNodePause(nodeId);
	}

	/**
	 * Check if a node is paused.
	 */
	isNodePaused(nodeId: string): boolean {
		return this.pausedNodes.has(nodeId);
	}

	/**
	 * Set a bitmap for an external texture node.
	 */
	setBitmap(nodeId: string, bitmap: ImageBitmap): void {
		this.textureStore.set(nodeId, bitmap, this.ctx.regl);

		this.v1.setBitmap(nodeId, bitmap);
	}

	/**
	 * Remove a bitmap for a node.
	 */
	removeBitmap(nodeId: string): void {
		this.textureStore.remove(nodeId);

		this.v1.removeBitmap(nodeId);
	}

	/**
	 * Remove uniform data for a node.
	 */
	removeUniformData(nodeId: string): void {
		this.uniformsStore.clear(nodeId);

		this.v1.removeUniformData(nodeId);
	}

	/**
	 * Set preview size.
	 */
	async setPreviewSize(width: number, height: number): Promise<void> {
		this.ctx.previewSize = [width, height];

		await this.v1.setPreviewSize(width, height);
	}

	/**
	 * Set output size.
	 */
	setOutputSize(width: number, height: number): void {
		this.ctx.outputSize = [width, height];

		this.v1.setOutputSize(width, height);
	}

	/**
	 * Get output bitmap for the final frame.
	 */
	async getOutputBitmap(): Promise<ImageBitmap | null> {
		// Check if we have a V2 output node
		if (this.outputNodeId && this.nodes.has(this.outputNodeId)) {
			// V2 has already blitted to the canvas in renderFrame
			// Convert the offscreen canvas to a bitmap
			try {
				const bitmap = await this.ctx.offscreenCanvas
					.convertToBlob()
					.then((blob) => createImageBitmap(blob));
				return bitmap;
			} catch (error) {
				logger.error('[VideoWorkerService] failed to convert canvas to bitmap:', error);
				return null;
			}
		}

		// Fallback to V1
		return this.v1.getOutputBitmap();
	}

	/**
	 * Capture a preview frame for a specific node.
	 */
	getPreviewFrameCapture(nodeId: string, customSize?: [number, number]): Uint8Array | null {
		const v2Node = this.nodes.get(nodeId);

		if (v2Node) {
			const externalTexture = this.textureStore.get(nodeId);

			if (externalTexture) {
				return captureTexturePreview(this.ctx, externalTexture, customSize);
			}

			return capturePreview(this.ctx, v2Node.framebuffer, customSize);
		}

		return this.v1.getPreviewFrameCapture(nodeId, customSize);
	}

	/**
	 * Update JS module in JSRunner.
	 */
	updateJSModule(moduleName: string, code: string | null): void {
		this.v1.updateJSModule(moduleName, code);
	}

	/**
	 * Get the stores object for passing to nodes.
	 */
	private getStores(): VideoStores {
		return {
			uniforms: this.uniformsStore,
			fft: this.fftStore,
			textures: this.textureStore
		};
	}

	/**
	 * Get input textures for a node based on the render graph.
	 * Maps inlet index to source node texture.
	 */
	private getInputTextures(
		renderNode: RenderGraph['nodes'][0] | undefined
	): Map<number, regl.Texture2D> {
		const textureMap = new Map<number, regl.Texture2D>();

		if (!renderNode) return textureMap;

		// Use inletMap for proper slot-based assignment
		for (const [inletIndex, sourceNodeId] of renderNode.inletMap) {
			// Check if source is an external texture
			if (this.textureStore.has(sourceNodeId)) {
				const texture = this.textureStore.get(sourceNodeId);

				if (texture) {
					textureMap.set(inletIndex, texture);
					continue;
				}
			}

			// Check if source is a V2 node
			const sourceNode = this.nodes.get(sourceNodeId);
			if (sourceNode) {
				textureMap.set(inletIndex, sourceNode.texture);
				continue;
			}

			// Fallback to V1 renderer
			const nodeV1 = this.v1.getFboNodeById(sourceNodeId);

			if (nodeV1) {
				textureMap.set(inletIndex, nodeV1.texture);
			}
		}

		return textureMap;
	}
}
