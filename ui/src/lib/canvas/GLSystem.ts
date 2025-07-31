import { buildRenderGraph } from '$lib/rendering/graphUtils';
import type { RenderGraph } from '$lib/rendering/types';
import RenderWorker from '$workers/rendering/renderWorker?worker';
import type { Edge, Node } from '@xyflow/svelte';

import * as ohash from 'ohash';
import { previewVisibleMap, isGlslPlaying } from '../../stores/renderer.store';
import { get } from 'svelte/store';

export class GLSystem {
	/** Web worker for offscreen rendering. */
	public renderWorker: Worker;

	/** Rendering context for the background output that covers the entire screen. */
	public backgroundOutputCanvasContext: ImageBitmapRenderingContext | null = null;

	/** Mapping of nodeId to rendering context for preview */
	public previewCanvasContexts: Record<string, ImageBitmapRenderingContext | null> = {};

	private static instance: GLSystem;
	private hashes = { nodes: '', edges: '', graph: '' };
	private renderGraph: RenderGraph | null = null;

	static getInstance() {
		if (!GLSystem.instance) {
			GLSystem.instance = new GLSystem();
		}

		// @ts-expect-error -- expose globally for debugging
		window.glSystem = GLSystem.instance;

		return GLSystem.instance;
	}

	constructor() {
		this.renderWorker = new RenderWorker();
		this.renderWorker.addEventListener('message', this.handleRenderWorkerMessage.bind(this));
	}

	handleRenderWorkerMessage = async (event: MessageEvent) => {
		const { data } = event;

		if (data.type === 'animationFrame' && data.outputBitmap) {
			this.backgroundOutputCanvasContext?.transferFromImageBitmap(data.outputBitmap);
		}

		// Handle preview frames
		if (data.type === 'previewFrame' && data.buffer) {
			const { nodeId, buffer, width, height } = data;

			const context = this.previewCanvasContexts[nodeId];
			if (!context) return;

			const uint8Array = new Uint8Array(buffer);

			const imageData = new ImageData(new Uint8ClampedArray(uint8Array), width, height);
			const bitmap = await createImageBitmap(imageData);

			context.transferFromImageBitmap(bitmap);
		}
	};

	start() {
		if (get(isGlslPlaying)) return;

		this.send('startAnimation');
		isGlslPlaying.set(true);
	}

	stop() {
		if (!get(isGlslPlaying)) return;

		this.send('stopAnimation');
		isGlslPlaying.set(false);
	}

	setOutputEnabled(enabled: boolean) {
		this.send('setOutputEnabled', { enabled });
	}

	setPreviewEnabled(nodeId: string, enabled: boolean) {
		this.send('setPreviewEnabled', { nodeId, enabled });
	}

	togglePreview(nodeId: string) {
		const visibleMap = get(previewVisibleMap);

		visibleMap[nodeId] = !visibleMap[nodeId];
		previewVisibleMap.set(visibleMap);

		this.setPreviewEnabled(nodeId, visibleMap[nodeId]);
	}

	send<T>(type: string, data?: T) {
		this.renderWorker.postMessage({ type, ...data });
	}

	updateRenderGraph(nodes: Node[], edges: Edge[]) {
		if (this.hasFlowGraphChanged(nodes, edges)) return;

		const graph = buildRenderGraph(nodes, edges);
		if (this.hasRenderGraphChanged(graph)) return;

		this.send('buildRenderGraph', { graph });
		this.renderGraph = graph;
	}

	// TODO: optimize this!
	hasFlowGraphChanged(nodes: Node[], edges: Edge[]) {
		const nHash = ohash.hash(nodes);
		const eHash = ohash.hash(edges);

		if (nHash === this.hashes.nodes && eHash === this.hashes.edges) return true;

		this.hashes.nodes = nHash;
		this.hashes.edges = eHash;

		return false;
	}

	hasRenderGraphChanged(graph: RenderGraph) {
		const gHash = ohash.hash(graph);
		if (this.hashes.graph === gHash) return true;

		this.hashes.graph = gHash;
		return false;
	}
}
